# spike: Supabaseクライアント軽量化の技術検証（R07）

- 対象: `@supabase/supabase-js`（`createClient`）を使わず、`@supabase/auth-js`（`GoTrueClient`）+ `@supabase/postgrest-js`（`PostgrestClient`）を直接組む構成の実現可否とバンドル削減効果
- 位置づけ: **調査のみ**（本体コード非変更）。実装可否の最終判断はオーナー（DESIGN.md / TICKETS.md）
- 併読裁定: REVIEW_NOTES.md **B7**（互換ラッパー見積もりに `.rpc()` を含める／計測は `vite build` の gzip 値で R04 と統一）、**B4**（R04 未達原因が supabase-js なら本報告書に接続）
- 計測日: 2026-07-22 / 計測環境: Node v26.4.0, npm 11.17.0, Vite 6.3.5（`vite build` 既定＝esbuild minify）
- プロトタイプ所在: スクラッチディレクトリ（リポジトリ外・使い捨て）

---

## (1) 現行 `supabase.*` 使用 API 面の棚卸し（コード実測）

`src/` 全体を grep した実測（`getFunctionsBaseUrl` は URL 生成ヘルパのため除外）。

### auth 系メソッド（`supabase.auth.*`）

| メソッド | 使用箇所（代表） | 備考 |
|---|---|---|
| `getSession` | AuthContext.tsx:74,83 / ResetPassword.tsx:31 / adminApi.ts:67 | 4 箇所 |
| `refreshSession` | adminApi.ts:71,113 | 2 箇所（Edge Function トークン取得） |
| `signInWithPassword` | AuthContext.tsx:151 | 1 箇所 |
| `signOut` | AuthContext.tsx:107,165 / ResetPassword.tsx:70 / AcceptInvite.tsx:127,178 | 5 箇所 |
| `onAuthStateChange` | AuthContext.tsx:133 | 1 箇所（セッション追従の起点） |
| `getUser` | AcceptInvite.tsx:130,181,235 | 3 箇所 |
| `updateUser` | ResetPassword.tsx:61 / AcceptInvite.tsx:244 | 2 箇所（パスワード設定） |
| `verifyOtp` | AcceptInvite.tsx:69 | 1 箇所 |
| `setSession` | AcceptInvite.tsx:79 | 1 箇所 |
| `exchangeCodeForSession` | ResetPassword.tsx:26 / AcceptInvite.tsx:62 | 2 箇所（PKCE リンク） |
| `resetPasswordForEmail` | Forgot.tsx:22 | 1 箇所 |
| `getSessionFromUrl` | ResetPassword.tsx:29 / AcceptInvite.tsx:89 | **S8 の実バグ**。supabase-js 2.56 に存在しない誤用。R11 で `setSession`/`exchangeCodeForSession` へ置換予定。ラッパー設計は R11 後の正規 API を前提にする |

> **チケット記載との差分（訂正）**: R07 本文および grep 一覧に含まれていた `signUp` は、`src/` 全体で使用 0 件（`Register.tsx` は `supabase` を直接 import していない）。**互換ラッパーの必須対象から `signUp` は外してよい**（将来の自己登録実装時に追加すればよい）。これ以外のメソッドは本文どおり実在を確認。

### PostgREST 操作（`supabase.from(table).*`）

- テーブル: `units` / `categories` / `questions` / `profiles`（他テーブルの直接アクセスなし）
- 操作: `select` / `insert` / `update` / `delete`、連鎖メソッドは `eq` / `in` / `order` / `single`（`.from()` 全 34 箇所）
- 例: `units` 参照系（UsersManagement.tsx:74 ほか）、`questions` の delete（QuestionsManagement.tsx:222,330）/ insert（AssignmentsManagement.tsx:964）、`profiles` の参照/更新（AuthContext.tsx:43 / AcceptInvite.tsx:138,190,253）

### RPC（`supabase.rpc()`）— 将来増える面

- **現状 0 件**。
- **X03/X04 で 1 種追加**: `supabase.rpc('import_questions', { p_rows })`（X04.md:171）。X03 が `public.import_questions(jsonb)`（`security definer`）を新設し、X04 のインポート UI が呼ぶ。
- → **B7 裁定どおり、互換ラッパーは postgrest-js の `.rpc()` を対象に含める**（見積もりに反映済み。下記 (4)）。

### `createClient` の `auth` オプション

`persistSession: true` / `autoRefreshToken: true` / `detectSessionInUrl: true`（supabase.ts:12-16）。いずれも auth-js（`GoTrueClient`）のコンストラクタオプションにそのまま存在する。

---

## (2) storage / realtime / functions の未使用確定

| サブクライアント | 使用箇所 | 判定 |
|---|---|---|
| storage-js（`supabase.storage`） | **0 件** | 排除しても機能影響なし |
| realtime-js（`supabase.channel` / realtime / `removeChannel`） | **0 件** | 同上 |
| functions-js（`functions.invoke`） | **0 件** | 同上 |

- Edge Function 呼び出しは `adminApi.ts` が **生 `fetch`** で行っている（adminApi.ts:10, 89）。`getFunctionsBaseUrl`（supabase.ts:19）は URL 文字列を組むだけのヘルパで、functions-js は介在しない。→ **functions-js は完全に不要**。
- したがって supabase-js が同梱する storage-js / realtime-js / functions-js は、本アプリでは 3 つとも **デッドコード**。これらを外すのが本 spike の削減源。

---

## (3) プロトタイプのビルドサイズ実測

同一の最小利用コード（`auth.getSession()` → `from('units').select(...).order(...)` → `rpc('import_questions', ...)`）を 2 構成で `vite build`（既定 minify）し、生成された単一エントリチャンクの raw / gzip を比較。バージョンは本体 `package-lock.json` に固定（supabase-js 2.56.0 / auth-js 2.71.1 / postgrest-js 1.21.3）。gzip はVite 報告値を採用し、`gzip -c | wc -c` で独立クロスチェック済み（一致）。

| 構成 | 取り込む @supabase パッケージ | 変換モジュール数 | raw（min, kB） | gzip（kB） |
|---|---|---:|---:|---:|
| (A) supabase-js `createClient` | supabase-js, auth-js, postgrest-js, **realtime-js, storage-js, functions-js**, node-fetch | 62 | **141.48**（141,476 B） | **38.82**（38,836 B） |
| (B) auth-js + postgrest-js 直接 | auth-js, postgrest-js, node-fetch のみ | 38 | **75.63**（75,634 B） | **20.73**（20,747 B） |
| **差分 (A − B)** | realtime-js / storage-js / functions-js / supabase-js ラッパを排除 | −24 | **−65.84** | **−18.09** |
| **削減率** | | | **46.5 %** | **46.6 %** |

**要点（過大評価の是正）**: チケット目的の「storage 84KB + realtime 73KB + functions 7.5KB ＝計約 165KB」は各パッケージの **minify 前ソース総量**。実際に production バンドルへ入る量は tree-shaking + minify 後で圧縮し、**実測の増分は gzip で約 18 KB / raw で約 66 KB**。これがラッパー化で削減できる上限値。

**R04（B4）への接続**: R04 のアプリ全体ベースラインは 671KB / gzip 192KB。本 spike の削減 18 KB gzip は、その **全体 gzip の約 9.4 %** に相当。supabase クライアントは全ユーザー（受講生含む）が読む共有 vendor チャンクに載るため、R04 のルート分割では消えない初回 DL コストであり、本削減はその初回 DL に直接効く。ただしバンドル支配項は react / react-dom / react-router / radix-ui であり、18 KB gzip は「効くが中規模」の削減である点は明記しておく。

---

## (4) 互換ラッパーの実装コストとリスク

方針: 現行の `export const supabase`（`supabase.auth.*` / `supabase.from().*` / `supabase.rpc()`）と**同一表面**を保つ薄いラッパーを **`src/app/lib/supabase.ts` に閉じ込め**、本体の他ファイル（呼び出し側）は無変更にする。

### 変更範囲

- **`supabase.ts` のみ**を書き換え（`createClient` → `GoTrueClient` + `PostgrestClient` の合成 + 表面互換の `supabase` オブジェクト公開）。呼び出し側 11 ファイルは表面が同一なら無変更。
- auth-js 単体の `GoTrueClient` は、supabase-js が内部で使う `SupabaseAuthClient`（`GoTrueClient` の薄い派生）とほぼ同一 API。上記 (1) の auth メソッド群は基本そのまま使える見込み。
- `from()` / `rpc()` は `PostgrestClient` が同名 API を持つため、`supabase.from` / `supabase.rpc` をそのまま委譲できる。

### 破壊リスク（要手当て）

1. **セッション → PostgREST ヘッダの自動連携（最重要 / RLS）**
   `createClient` は内部で `onAuthStateChange` を購読し、access_token を REST の `Authorization` ヘッダへ反映している。直接組み立て版では **これを手動配線**する必要がある（本 spike では `auth.onAuthStateChange(() => rest.headers.Authorization = 'Bearer ' + token)` で再現）。ミスると全 `from()`/`rpc()` が anon トークンのまま飛び **RLS で 401/空返却** になる。→ **中〜高リスク**。初期セッション反映（起動時 getSession → ヘッダ設定）の取りこぼしにも注意。
2. **`detectSessionInUrl`（招待 / パスワード再設定リンク）**
   auth-js にも同名オプションは存在するが、`AcceptInvite` / `ResetPassword` の PKCE / OTP リンク処理は現状 `getSessionFromUrl`（S8 バグ）に依存している。**ラッパー化は R11（正規 API 化）後に行う前提**なら、正規 `exchangeCodeForSession` / `setSession` に対して等価挙動を確認すればよく、齟齬が小さい。→ R11 前に着手すると二重で壊すリスク。
3. **`apikey` ヘッダの全リクエスト付与**
   REST / auth の両方に `apikey` と `Authorization` を初期ヘッダとして持たせる必要。`from()` は呼び出し時にクライアントの headers を展開するため、ヘッダオブジェクトの参照を保って更新すれば全 `from()`/`rpc()` に伝播する（本 spike で確認）。→ 低リスクだが配線漏れ注意。
4. **バージョン整合の保守負担**
   単一の supabase-js ではなく auth-js / postgrest-js を個別ピン留めする。両者の API ドリフト（メジャー更新時）を個別に追う必要。→ 低リスク・恒常コスト小。

### 規模見積もり（S / M / L）

- 実装（`supabase.ts` の合成 + ヘッダ配線 + 型面の互換）: **S〜M**
- 認証フロー等価性の検証（招待受諾 / パスワード再設定 / ログイン / RLS 越しの from・rpc）: **M**（E2E 必須）
- **総合: M**（純コード量は小さいが、認証・RLS の回帰検証コストが支配的）

---

## (5) 推奨判断（やる / やらない）と根拠

### 推奨: **条件付きで「やる」（優先度=中／急がない）**

**根拠（やる側）**
- 削減は実測で **gzip 約 18 KB（該当部の 46.6 %減）/ raw 約 66 KB**。全ユーザーが必ず読む共有 vendor チャンクに載る分で、R04 のルート分割でも消えない初回 DL コストに直接効く（全体 gzip の約 9 %）。
- 実現可能性は **実証済み**（B 構成が同一 API 面でビルド成功）。変更は `supabase.ts` に隔離でき、呼び出し側 11 ファイルは無変更で済む見込み。
- storage/realtime/functions は 3 つとも使用 0 件で、排除に機能上の副作用がない（デッドコード除去）。realtime-js を落とすと `ws` 等の推移的依存も外れ、`npm audit`（脆弱性 12 件）の対象面をわずかに縮小できる可能性（評価は R01 範囲）。

**根拠（慎重側 / 条件の理由）**
- 18 KB gzip は「効くが中規模」。バンドル支配項は React 系であり、これ単独でアプリ体感が激変するものではない。
- 認証（招待・パスワード再設定・RLS トークン連携）は事業上クリティカルで、ヘッダ手動配線のミスが **サイレントな RLS 障害**になり得る。効果の割にダウンサイド（回帰リスク）が非ゼロ。

### 実施条件（この 3 点を満たす場合にのみ着手を推奨）
1. **R11（正規 auth API 化）完了後**に着手（`getSessionFromUrl` 誤用を残したままラッパー化しない）。
2. **認証 E2E を必須ゲート**にする（招待受諾 / パスワード再設定 / ログイン / RLS 越しの `from`・`rpc`。REVIEW_NOTES C2 の最終ゲートに組み込む）。
3. **単独チケット（M 規模）として分離**し、他リファクタと混ぜない（切り戻しを容易に）。

### 見送る場合の妥当性（オーナー判断用の対案）
リスク回避を最優先するなら **現状維持（supabase-js のまま）も合理的**。18 KB gzip は許容範囲で、React 系が支配的なバンドル構成では投資対効果が中程度にとどまるため。**最終判断はオーナーに委ねる**（本 spike は推奨提示まで）。

---

## (6) やる場合の実装アウトライン（別チケット化の粒度）

前提: **R11 完了後**に、以下を **単独チケット（M）** として起票。

1. **`supabase.ts` の合成置換**
   - `GoTrueClient`（`url: {url}/auth/v1`、`headers: {apikey, Authorization}`、`storageKey: sb-{ref}-auth-token`、`persistSession/autoRefreshToken/detectSessionInUrl`）を生成。
   - `PostgrestClient`（`{url}/rest/v1`、`headers: {apikey, Authorization}`）を生成。
   - 起動時（初回 `getSession`）と `onAuthStateChange` で access_token を REST ヘッダへ反映する配線を実装（ヘッダオブジェクトの参照を保持して更新）。
   - `export const supabase = { auth, from: rest.from.bind(rest), rpc: rest.rpc.bind(rest) }` の形で **現行と同一表面**を公開。`getFunctionsBaseUrl` は現状維持。
2. **型面の互換確認**: 呼び出し側が使う戻り値型（`{ data, error }`、`session`、行型）が現行と一致することを `npm run typecheck` で担保（呼び出し側は無変更が目標）。
3. **依存整理**: `@supabase/supabase-js` を外し、`@supabase/auth-js` / `@supabase/postgrest-js` を direct dependency に格上げ（バージョンは現行推移解決値に合わせてピン）。
4. **検証ゲート**: `typecheck` + `build`（500KB 警告の再確認）+ 認証 E2E（招待 / 再設定 / ログイン / RLS 越し `from`・`rpc`）を必須化。実測サイズ（before/after gzip）を PR に記録。
5. **切り戻し容易性**: 変更は `supabase.ts` + `package.json` に限定。問題時は 1 コミットで revert 可能な粒度にする。

---

## 付記

- 本 spike のプロトタイプ（A/B 2 プロジェクト）はスクラッチディレクトリで作成・計測しており、**本体リポジトリには一切含めない**（成果物は本報告書 1 ファイルのみ）。
- 脆弱性警告 12 件（critical 1 / high 8）は R01 の依存削減後に `npm audit` 再評価が本筋（本チケット範囲外）。realtime-js 排除による推移的依存の縮小はその際に併せて確認するとよい。
