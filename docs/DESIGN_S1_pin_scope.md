# S1対策 設計書 — 公開APIの認可バイパス / PINスコープトークン方式

作成: 2026-07-22 / ステータス: **設計のみ（本改修では実装しない）**

- 位置づけ: `docs/DESIGN.md` セキュリティ診断 S1 の対策設計。オーナー確定事項「**S1は設計のみ・実装は別スケジュール**」に従い、本書は方式・インターフェース・照合ルール・移行方針までを定義し、**実装用の SQL / コードは含めない**。
- 関連: `SPEC.md` §8.4（公開エンドポイント）/ §11.1（S1既知課題）。R09（PINハッシュ化・レート制限）との関係は §8 に記載。

---

## 1. 背景・問題（S1）

現状、受講生向け公開API（`supabase/functions/server/index.ts`）は Edge Function が **service role で実行し RLS をバイパス**する。会社ライセンス（`companies.allowed_unit_ids`）の照合は**フロント側でのみ**行われている。

- `GET /public/quiz-data`: 全単元・全カテゴリを無条件に返す。
- `GET /public/unit-categories/:unitId`: 任意の `unitId` について単元・カテゴリ・公開問題IDを返す。
- `POST /public/questions`: `{ categoryId | categoryIds | unitId }` に対し公開問題を返す。**レスポンスに `correctAnswer`（正解）を含む**。
- ライセンス照合はフロントの `QuizSetup.tsx`（`selectedCompany.allowedUnitIds` による `units.filter(...)`）に限られ、サーバは要求単元が会社ライセンスに含まれるかを検証しない。

### 失敗シナリオ
API を直接呼び出せば、`/public/verify-pin`（会社PIN検証）を経ずに、**他社ライセンス単元を含む任意単元の全問題（正解込み）を取得可能**。結果として、会社別ライセンス制御が実質無効化される。

### 根拠
- `server/index.ts`: `/public/quiz-data` `/public/unit-categories/:unitId` `/public/questions` の各ハンドラ（service role・PIN照合なし）。
- `src/app/components/quiz/QuizSetup.tsx`: `allowedUnitIds` によるフィルタがクライアント側のみ。
- `src/app/lib/adminApi.ts`: `publicFetch` は `apikey`（anon key）を付与するのみで、スコープトークンの概念がない。

---

## 2. 方式概要（PINスコープトークン）

`POST /public/verify-pin` の成功時に、**短命の署名付きスコープトークン**を発行する。以降の公開データ取得API（`/public/quiz-data` `/public/unit-categories/:unitId` `/public/questions`）は、このトークンを検証し、**トークンに埋め込んだ会社スコープ（`companyId` / `allowedUnitIds`）と要求内容（単元・カテゴリ）をサーバ側で照合**する。

- 照合の真実の所在を**フロントからサーバへ移す**ことが目的。正規UIフロー（PIN入力 → 学習）の見た目・操作は不変。
- トークンはステートレス（署名検証のみ）で、追加のインフラ（セッションストア等）を要しない。

---

## 3. トークン仕様

- **形式**: JWT（HS256）。署名鍵は Edge Function の共有秘密 `PIN_SCOPE_SECRET`（新規シークレット）または Supabase の JWT 秘密のいずれかを採用（実装時に決定）。
- **ペイロード（クレーム）**:
  - `companyId`: 検証済み会社ID
  - `allowedUnitIds`: 当該会社の履修単元ID配列（検証時点のスナップショット）
  - `iat` / `exp`: 発行時刻・失効時刻
  - （任意）`scope: "pin"` 等の種別識別子
- **有効期限**: 短命（例: 30〜60分）。学習セッションが超過する場合は、PIN再入力または後述のリフレッシュ方針で継続する。
- **受け渡し**:
  - 発行: `/public/verify-pin` のレスポンスボディで返す（既存の `{ id, name, allowedUnitIds }` に `scopeToken` を追加）。
  - 保持: フロントは `CompanyContext` に保持（`localStorage` 併用可。ただし短命前提）。
  - 送信: 以降の公開APIリクエストで `Authorization: Bearer <scopeToken>` あるいは専用ヘッダ `x-pin-scope: <scopeToken>` として付与。
- **秘密の扱い**: `allowedUnitIds` はスナップショットのため、会社ライセンス変更の反映はトークン失効（`exp`）まで遅延する点を許容する（短命化で緩和）。

---

## 4. サーバ側検証（照合ロジック）

各公開データ取得APIは、まずトークンを検証（署名・`exp`）し、続いて要求スコープを照合する。

- **共通**: トークン無効/欠落/期限切れ → `401`。トークンは有効だが要求がスコープ外 → `403`。
- `POST /public/questions`:
  - 要求の `categoryId(s)` / `unitId` を対象カテゴリ集合に解決し、各カテゴリの所属 `unit_id` を求める。
  - 解決した `unit_id` が**すべて** `token.allowedUnitIds` に含まれることを検証。1つでも含まれなければ `403`（部分許可はしない）。
- `GET /public/unit-categories/:unitId`:
  - `unitId ∈ token.allowedUnitIds` を検証。含まれなければ `403`。
- `GET /public/quiz-data`:
  - 返却する `units` / `categories` を `token.allowedUnitIds` でフィルタして返す（トークン必須化。全件返却を廃止）。
- `POST /public/verify-pin`: トークン不要（トークンの発行元）。`GET /public/companies`（会社名一覧・PIN非返却）も従来どおりトークン不要とする。

---

## 5. フロント改修範囲（実装時の対象・本書では実装しない）

- `SelectCompany.tsx`: `verifyPin` 成功時に `scopeToken` を受領し、`CompanyContext` へ保存。
- `context/CompanyContext.tsx`: `SelectedCompany` にトークンを保持（および失効時のクリア）。
- `lib/adminApi.ts`（`publicApi` / `publicFetch`）: データ取得系の各リクエストにトークンを自動付与。`401` 応答時は会社選択（PIN再入力）へ誘導。
- `quiz/QuizSetup.tsx` / `quiz/Quiz.tsx` / `assignment/CategoryList.tsx` / `assignment/UnitSelect.tsx`: トークン前提のデータ取得に統一（フロント側フィルタは冗長化するがUI互換のため当面維持可）。

---

## 6. 移行・後方互換

段階導入でダウンタイム・受講生影響を回避する。

1. **フェーズ1（トークン任意）**: サーバはトークンがあれば照合、無ければ従来どおり許可しつつ**警告ログ**を記録。フロントはトークン送出を開始。
2. **フェーズ2（監視）**: トークン未提供リクエストの割合をログで監視し、正規フロントからの未提供がゼロになったことを確認。
3. **フェーズ3（必須化）**: トークン未提供を `401` として拒否。以降はスコープ照合を常時適用。

- ロールバック: 各フェーズは独立に切り戻し可能（フェーズ3のみ受講生影響があるため監視結果を条件に実施）。

---

## 7. 代替案比較

| 案 | 概要 | 長所 | 短所 | 失効性 | インフラ増 |
|----|------|------|------|--------|-----------|
| **(i) PINスコープトークン（JWT）** ✅**推奨** | verify-pin で短命署名トークンを発行し、公開APIでスコープ照合 | ステートレスで追加ストア不要。既存の公開API構成に最小追加。正規フロー挙動不変 | `allowedUnitIds` はスナップショットで、ライセンス変更反映が `exp` まで遅延。鍵管理が必要 | `exp` 依存（短命化で緩和） | なし（署名鍵のみ） |
| (ii) サーバ側セッション | verify-pin 状態を Redis / テーブルに保持し、セッションIDで照合 | 即時失効が容易。ライセンス変更を都度反映可能 | セッションストアの新設・運用が必要。ステートフル化 | 即時（明示失効可） | あり（Redis/テーブル + 掃除） |
| (iii) 受講生も匿名 Supabaseセッション化 | 受講生に匿名認証セッションを付与し、RLS へ寄せる | 認可を RLS に一元化。フロント照合を排除 | 大改修（会社紐付けの RLS 設計・匿名ユーザー管理・既存公開API廃止）。影響範囲が最大 | RLS/セッション依存 | あり（認可モデル再設計） |

### 推奨: **(i) PINスコープトークン（JWT）**
- 理由: S1 の本質（照合がフロントのみ）をサーバ照合へ移す最小変更で解決でき、追加インフラ不要・正規フロー挙動不変。短命化と段階導入でリスクを抑制できる。
- ライセンス変更の即時反映が要件化した場合は、将来 (ii) のセッション方式へ段階移行する余地を残す（トークンの `exp` を短く保つことで実運用上の乖離は限定的）。

---

## 8. 非スコープ / 申し送り

- **PINのハッシュ化（S3 / R09備考）**: 本方式は「PIN検証済みであること」をトークンで証明する仕組みであり、PIN自体の保存形式（平文→ハッシュ化）とは独立。R09でPINをハッシュ化する場合、`verify-pin` の照合ロジックのみ差し替えればよく、本方式のトークン発行・検証には影響しない。
- **公開エンドポイントのレート制限（R09）**: `verify-pin` の総当たり対策（試行レート制限）は本方式と併用する前提。トークンは検証済みPINにのみ発行されるため、レート制限と組み合わせることで総当たりと直叩きの双方を塞ぐ。
- **`UNIQUE(pin)`（S3）**: 会社PINの一意制約は本方式の前提（`maybeSingle` の複数ヒット回避）。R09/別スケジュールで対応。
- **実装スケジュール**: 本書は設計のみ。実装（Edge Function のトークン発行・検証、フロント改修、シークレット設定、段階導入の各フェーズ）は別チケット・別スケジュールで行う。
