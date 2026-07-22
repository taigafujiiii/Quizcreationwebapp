# クイズ学習システム 仕様書（開発〜本番デプロイまで）

このドキュメントは「このリポジトリだけを渡されても、1から同等の環境を構築して本番まで動かせる」粒度を目標にまとめています。

## 1. 概要
- 学習者向けのクイズ学習（自由演習 / 課題コース）と、管理者向けのコンテンツ・ユーザー管理を提供するSPA。
- フロントエンド: Vite + React + react-router-dom
- バックエンド: Supabase（Auth / PostgREST / RLS / Edge Functions）
- 管理者向けAPI: Supabase Edge Function（`server`）

## 2. 本番構成（Production）
- フロント: Vercel（`main` ブランチのpushでデプロイ）
- Supabase:
  - DB（コンテンツ・権限）: `public.units / public.categories / public.questions / public.profiles`
  - DB（会社PINフロー・運用ログ）: `public.companies / public.registration_requests / public.invite_logs`
    - `companies` は `allowed_unit_ids uuid[]`（会社単位の履修単元）と `pin text`（会社PIN・平文）の列を持つ
    - `profiles.company_id`（`companies` 参照）で受講生アカウントと会社を紐付け
  - Auth:
    - 管理者・招待済みユーザー: Email/Password + 招待（invite）
    - 受講生（主経路）: **アカウント不要の会社PIN方式**（`/select-company` で会社PINを入力して学習）
  - RLS: `profiles.role` と `profiles.allowed_unit_ids` に基づくアクセス制御。`companies` / `registration_requests` は Edge Function（service role）経由での参照・更新を前提とする（§4.2 参照）
  - Edge Functions: `server`（管理者API + 受講生向け公開API）

## 3. ルーティング（主要画面）

以下は `src/app/App.tsx` に**実際に登録されているルート**を記載する。

### 公開（認証不要）
- `/login` ログイン（管理者・招待済みユーザー向け）
- `/forgot` パスワード再設定（申請）
- `/select-company` 会社選択 + 会社PINログイン（受講生の入口。`SelectCompany.tsx`）

### 受講生（ログイン不要・会社選択必須）
`/select-company` で会社PINを検証して会社を選択すると、以下のルートが利用可能になる（未選択時は `/select-company` へリダイレクト）。
- `/` ホーム（コース選択）
- `/quiz/setup` 自由演習の条件設定
- `/quiz` クイズ実行
- `/result` 結果
- `/assignment/units` 課題コースの単元選択
- `/assignment/categories/:unitId` 課題コースのカテゴリ選択

### 管理者
- `/admin` 管理者ダッシュボード
- `/admin/units` 単元管理
- `/admin/categories` カテゴリ管理
- `/admin/questions` 問題管理
- `/admin/assignments` 課題管理（課題フラグ付与、課題問題作成、CSVインポート）
- `/admin/users` ユーザー管理（招待、権限、学習可能単元、削除）
- `/admin/companies` 会社管理（会社CRUD、会社PIN設定、履修単元割当。`CompaniesManagement.tsx`）

（上記以外のパスは `/`（受講生ホーム）へリダイレクトされる）

### 認証フロー（招待受諾・メール認証・パスワード再設定・自己登録）は現行UIでは未提供
現状（2026-07-22 時点・オーナー確定「PIN方式のみで現状追認」）、以下の画面は**コンポーネントは実在するが `App.tsx` に Route 登録されておらず、UIからは到達できない**。
- `/accept-invite`（招待受諾登録。`AcceptInvite.tsx`）
- `/verify`（メール認証確認。`Verify.tsx`）
- `/reset-password`（パスワード更新。`ResetPassword.tsx`）
- `/register`（自己登録フォーム。`Register.tsx`）

**既知の課題（送信側がリンク切れ先を指している）** — 本改修外で別途整理する:
- 招待メールの遷移先 `INVITE_REDIRECT_URL`（Edge Function 側で `/accept-invite` に正規化）→ 未登録ルート
- `/forgot` のパスワード再設定メール遷移先 `.../reset-password`（`Forgot.tsx`）→ 未登録ルート
- `/login` 画面内の「新規登録」リンク `to="/register"`（`Login.tsx`）→ 未登録ルート
- サインアップの確認メール遷移先 `.../verify`（`AuthContext.tsx`）→ 未登録ルート

## 4. 権限モデル

アクセス経路は**二層構造**になっている。

1. **受講生（主経路・アカウント不要）**: `/select-company` で会社PINを入力 → Edge Function `POST /public/verify-pin` が `companies.pin` を照合し、一致した会社の `allowed_unit_ids` を返す → フロントはその会社を選択状態にして受講生ルートを解放する。受講生は Supabase Auth のアカウントを持たず、学習データは公開API（`/public/*`）から取得する。
2. **管理者・招待済みユーザー（Supabase Auth）**: Email/Password でログインし、`profiles.role` と `profiles.allowed_unit_ids` で権限が決まる。`user` ロールのアカウント（招待→ログイン）も併存するが、受講生の主経路は上記1の会社PIN方式である。

### 4.1 roles（Supabase Auth ユーザー）
- `admin`
  - すべての単元/カテゴリ/問題へアクセス可能
  - 管理画面、管理者APIの利用が可能
- `user`
  - `profiles.allowed_unit_ids` に含まれる単元のみ閲覧可能
  - 管理画面、管理者APIは利用不可

### 4.2 アクセス制御（RLS）
- `profiles`: owner または admin が `select/update` 可能
- `units/categories/questions`: `admin` または `allowed_unit_ids` に紐づく範囲のみ `select` 可能
- 書き込み（`insert/update/delete`）は admin のみ（管理画面は admin 前提）
- `companies`: RLS 有効。**select ポリシー未定義**のため、通常の anon / authenticated からは参照できず、Edge Function（service role）経由でのみ参照・更新される（受講生の会社一覧・PIN照合は `/public/*` が service role で実行）。
- `registration_requests`: RLS 有効。ポリシーは `admin`（`is_admin()`）のみ全操作可。挿入は Edge Function（service role）が担う。

補足:
- RLS再帰（`stack depth limit exceeded`）回避のため、RLSで参照する `is_admin()` / `allowed_unit_ids()` は `SECURITY DEFINER` 関数として実装されます（`supabase/migrations/*fix_rls_stack_depth*.sql`）。
- 受講生向け公開API（`/public/*`）は service role で **RLS をバイパス**する。会社ライセンス（`allowed_unit_ids`）の照合が現状フロント側でのみ行われる点は §11 のセキュリティ注記（S1）を参照。

## 5. データモデル（DB）
### 5.1 `public.profiles`
- `id uuid` (PK, `auth.users` 参照)
- `email text`
- `role text` (`user` / `admin`)
- `username text`（最大50文字を想定）
- `allowed_unit_ids uuid[]`（`user` の学習可能単元）
- `is_active boolean`（ソフト削除フラグ）
- `company_id uuid`（`companies` 参照・`on delete set null`。招待/自己登録で作られた受講生アカウントの所属会社。`20260211000000_companies.sql`）
- `created_at / updated_at timestamptz`

### 5.2 `public.units`
- `id uuid` (PK)
- `name text`
- `description text`
- `created_at / updated_at timestamptz`

### 5.3 `public.categories`
- `id uuid` (PK)
- `unit_id uuid`（FK: units）
- `name text`
- `description text`
- `created_at / updated_at timestamptz`

### 5.4 `public.questions`
- `id uuid` (PK)
- `category_id uuid`（FK: categories）
- `text text`
- `option_a/b/c/d text`
- `answer_method text`（`radio` / `checkbox`）
- `correct_answer text`
  - `radio`: `A|B|C|D`
  - `checkbox`: `A,B,C` のようにカンマ区切り（順不同入力可、内部では比較時に正規化）
- `explanation text`
- `is_active boolean`（公開/非公開）
- `is_assignment boolean`（課題フラグ）
- `created_at / updated_at timestamptz`

### 5.5 更新競合（同時編集）対策
管理画面の更新は `updated_at` を条件に含める「楽観ロック」を採用します。

- 例（単元更新の概念）
  - 取得時に `updated_at` を保持
  - 更新時に `eq('updated_at', <保持値>)` を付与
  - 0件更新の場合は「他のユーザーが先に更新」として再取得

### 5.6 `public.companies`
会社単位のライセンス（履修単元）と会社PINを管理する（`20260211000000_companies.sql` / `20260327000000_registration_requests.sql` で `allowed_unit_ids` 追加 / `20260328000001_company_pin.sql` で `pin` 追加）。
- `id uuid` (PK)
- `name text`（`not null`・UNIQUE）
- `description text`（`not null default ''`）
- `allowed_unit_ids uuid[]`（`not null default '{}'`。会社が履修可能な単元。受講生の学習範囲）
- `pin text`（会社PIN。**平文保存**。UNIQUE制約・レート制限は現状なし → §11 のS3参照）
- `created_at / updated_at timestamptz`（`updated_at` はトリガで自動更新）

### 5.7 `public.registration_requests`
自己登録ワークフロー用の申請テーブル（`20260327000000_registration_requests.sql`）。※現状の登録フローは承認を経ず即時招待（§7.6・§8.4 の `/public/register-request` 注記参照）。
- `id uuid` (PK)
- `email text`（`not null`）
- `last_name text` / `first_name text`（`not null`）
- `company_id uuid`（`companies` 参照・`on delete cascade`・`not null`）
- `status text`（`not null default 'pending'`・CHECK `pending` / `approved` / `rejected`）
- `notes text`（`not null default ''`）
- `invited_user_id uuid`（`auth.users` 参照・`on delete set null`）
- `reviewed_by uuid`（`auth.users` 参照・`on delete set null`）
- `created_at timestamptz` / `reviewed_at timestamptz`

### 5.8 `public.invite_logs`
招待送信の監査・簡易レート制限用ログ（`20260208000000_invite_logs.sql`）。
- `id uuid` (PK)
- `inviter_id uuid`（`not null`。招待実行者）
- `invitee_email text`（`not null`）
- `invitee_role text`（`not null`・CHECK `user` / `admin`）
- `status text`（`not null`。`attempt` / `sent` / `failed` / `blocked_rate_limit` / `rejected_invalid_email` 等）
- `error text` / `invitee_user_id uuid` / `meta jsonb`（`not null default '{}'`）
- `created_at timestamptz`

## 6. クイズ仕様
### 6.1 出題対象
- `is_active = true` の問題のみ出題
- 課題コースは `is_assignment = true` のみ出題

### 6.2 回答方式
各問題は4択（A/B/C/D）で、回答方式は2種類:
- `radio`: 1つ選択（単一正解）
- `checkbox`: 複数選択（複数正解）

常に「わからない」を選択可能（`unknown` 扱い）。

### 6.3 結果
- 正解数、正答率、問題ごとの正誤・解説を表示
- 回答はクライアント状態で保持（成績の永続化は未実装）

## 7. 管理機能仕様（要点）
### 7.1 単元管理
- CRUD（作成/編集/削除）
- 更新は `updated_at` による競合検知あり

### 7.2 カテゴリ管理
- CRUD
- 単元で絞り込み
- 更新は `updated_at` による競合検知あり

### 7.3 問題管理
- CRUD
- 公開/非公開（`is_active`）切替
- 単元/カテゴリで絞り込み
- まとめて選択して削除
- 回答方式（`radio` / `checkbox`）と正解入力
- 更新/トグルは `updated_at` による競合検知あり

### 7.4 課題管理
- 課題問題（`is_assignment=true`）の作成/編集
- 既存問題を課題に追加/解除（`is_assignment` トグル）
- 単元/カテゴリで絞り込み
- CSVインポートで課題問題を一括作成
  - 正解: `radio` は `A`、`checkbox` は `A,B,C` のようにカンマ区切り
  - 回答方式: `radio` / `checkbox`
- 更新/トグルは `updated_at` による競合検知あり

### 7.5 ユーザー管理
- ユーザー一覧（検索、ロールフィルタ、削除済み表示）
- 編集: ユーザー名、学習可能単元（userのみ）
- 削除:
  - 1回目: `profiles.is_active=false`（ソフト削除）
  - 2回目: Authユーザー削除（ハード削除）
- 更新は `updated_at` による競合検知あり（Edge Function側で実装）

### 7.6 会社管理（`CompaniesManagement` / `/admin/companies`）
- 会社の CRUD（作成 / 削除）
- 会社PIN（`companies.pin`）の設定・クリア
- 履修単元の割当（`companies.allowed_unit_ids`。受講生の学習可能単元は所属会社のこの値に基づく）
- 削除ガード: 当該会社に所属する `is_active` ユーザーが存在する場合は削除不可（409）
- 補足（実態）: 会社更新（`PATCH /admin/companies/:id`）は他管理画面と異なり `updated_at` による楽観ロックを**持たない**（既知の差分。診断上の S5・詳細は `docs/DESIGN.md`）

### 7.7 登録申請管理（現行UIでは未提供）
- `RegistrationRequestsManagement` コンポーネントおよび管理API（`GET /admin/registration-requests`、`.../approve`、`.../reject`）は**実装済みだが `App.tsx` に Route 未登録**で、管理画面からは到達できない。
- 加えて受講生の自己登録API `POST /public/register-request` は**承認を待たず即時に招待メールを送信**する実装（`server/index.ts`）。そのため `registration_requests` を用いた承認ワークフローは実質バイパスされている。整理は本改修外。

## 8. 管理者API（Supabase Edge Function: `server`）
### 8.1 認証方式
- フロントは Supabase Auth の `access_token` を `Authorization: Bearer <token>` として送信
- 関数内で `adminClient.auth.getUser(token)` し、`profiles.role=admin` を必須チェック

### 8.2 管理者エンドポイント（`requireAdmin` で保護）
ユーザー:
- `GET /admin/users`
  - Authユーザー一覧 + profiles情報（会社名含む）を統合して返す
- `POST /admin/invite`
  - 招待メール送信（Supabase Admin API）。`role='user'` の招待は `companyId` 必須
  - `invite_logs` による簡易レート制限（招待者・被招待メール単位）
- `PATCH /admin/users/:id`
  - `username / role / allowedUnitIds / companyId` 更新（入力検証あり）
  - `updatedAt` 指定があれば楽観ロック（不一致は409）
- `POST /admin/users/:id/deactivate`
  - 1回目: `profiles.is_active=false`
  - 2回目: Authから削除

会社:
- `GET /admin/companies` — 会社一覧（`pin` 含む・管理画面用）
- `POST /admin/companies` — 会社作成（`name` 必須・最大100文字）
- `PATCH /admin/companies/:id` — `allowedUnitIds` / `pin` 更新（`pin: null` でクリア）
- `DELETE /admin/companies/:id` — 会社削除（所属 `is_active` ユーザーがいれば409）

登録申請（コンポーネントは未ルーティング。§7.7 参照）:
- `GET /admin/registration-requests?status=pending|approved|rejected|all`
- `POST /admin/registration-requests/:id/approve` — 招待送信 + profiles作成 + 申請を `approved` に更新
- `POST /admin/registration-requests/:id/reject` — 申請を `rejected` に更新

### 8.3 CORS
Edge Functionは `CORS_ORIGINS`（カンマ区切り）を設定可能。
- 未設定の場合は `*`（開発容易性優先）
- 本番はVercelのoriginなど、必要なoriginに限定する

### 8.4 公開エンドポイント（認証不要・受講生向け）
受講生（アカウント不要）が利用する公開API。いずれも Edge Function が **service role で実行し RLS をバイパス**する（`apikey` に anon key を付与するのみで、ユーザー認証は行わない）。
- `GET /public/companies` — 会社一覧（`id, name` のみ。**PINは返さない**）
- `POST /public/verify-pin` — `{ pin }` を `companies.pin` と照合し、一致会社の `{ id, name, allowedUnitIds }` を返す
- `GET /public/quiz-data` — 全単元・全カテゴリを返す
- `GET /public/unit-categories/:unitId` — 指定単元 + そのカテゴリ一覧 + 各カテゴリの公開問題ID
- `POST /public/questions` — `{ categoryId | categoryIds | unitId }` で公開問題（`is_active=true`）を返す。**`correctAnswer`（正解）を含む**
- `POST /public/register-request` — 自己登録。会社を指定し、**承認を待たず即時に招待メールを送信**（§7.7 参照）

**重要（既知リスク）**: `/public/quiz-data` `/public/unit-categories/:unitId` `/public/questions` は PIN検証と紐付いておらず、会社ライセンス（`allowed_unit_ids`）の照合が**フロント側のみ**である。§11 のセキュリティ注記（S1）および対策設計 `docs/DESIGN_S1_pin_scope.md` を参照。

## 9. 環境変数
### 9.1 フロント（Vite / Vercel）
`.env.local`（ローカル）や Vercel Environment Variables に設定:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_ADMIN_FUNCTION`（任意、デフォルト `server`）

### 9.2 Supabase Edge Function Secrets
Supabase Dashboard または CLI（`npx supabase secrets set`）で設定:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `INVITE_REDIRECT_URL`（例: `https://<your-domain>/accept-invite`）
- `CORS_ORIGINS`（例: `https://<your-domain>,http://localhost:5173`）

## 10. セットアップ手順（1から）
### 10.1 前提
- Node.js + npm
- Supabaseアカウント
- Vercelアカウント（本番デプロイする場合）
- Supabase CLI（npxで可）

### 10.2 依存関係
```bash
npm i
```

### 10.3 Supabaseプロジェクト作成
1. Supabaseで新規プロジェクト作成
2. Project URL（`https://<ref>.supabase.co`）と anon key を控える

### 10.4 DB作成（マイグレーション適用）
基本は Supabase CLI を推奨:
```bash
npx supabase login
npx supabase link --project-ref <your_project_ref>
npx supabase db push
```

seed投入（任意、SQL Editorでも可）:
- Supabase Dashboard の SQL Editor で `supabase/seed.sql` を実行
- または、手元で `supabase/seed.sql` の内容を確認して必要データを投入

### 10.5 Auth設定（Supabase Dashboard）
- Auth > URL Configuration
  - Site URL: `https://<your-domain>`
  - Redirect URLs:
    - `https://<your-domain>/accept-invite`
    - `https://<your-domain>/reset-password`
    - `https://<your-domain>/verify`
- Invite運用にしたい場合:
  - Email signups（サインアップ）をOFF
- 本番運用は SMTP 設定を推奨

### 10.6 Edge Function デプロイ（管理者API）
```bash
npx supabase functions deploy server --project-ref <your_project_ref>
```
Secrets設定（例）:
```bash
npx supabase secrets set --project-ref <your_project_ref> \
  SUPABASE_URL="https://<ref>.supabase.co" \
  SUPABASE_ANON_KEY="<anon_key>" \
  SUPABASE_SERVICE_ROLE_KEY="<service_role_key>" \
  INVITE_REDIRECT_URL="https://<your-domain>/accept-invite" \
  CORS_ORIGINS="https://<your-domain>,http://localhost:5173"
```

### 10.7 ローカル起動
`.env.local` を作成して値を設定:
```bash
cp .env.example .env.local
```
```bash
npm run dev
```

### 10.8 Vercel（本番）デプロイ
- Build command: `npm run build`
- Output: `dist`
- SPAルーティングは `vercel.json` の rewrites で対応
- Vercelの環境変数に `VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY` を設定

## 11. 仕様上の注意（運用）
- `anon key` は公開キーだが、想定外のオリジンからの管理者API呼び出しを避けるため `CORS_ORIGINS` は本番で絞る。
- 同時編集が起きうる運用（複数管理者）では、楽観ロックの競合メッセージが出ることがある（再読み込みで解消）。
- `.env.e2e` はローカル用（gitignore対象）。本番の認証情報をファイルで共有しない。

### 11.1 セキュリティ上の既知課題
本節は現状の**既知の未修正リスク**を事実として記録する（改修の進行状況により順次解消予定。全体診断は `docs/DESIGN.md` 参照）。

- **S1: 公開APIの認可バイパス（未修正・対策は設計のみ）**
  - `GET /public/quiz-data`、`GET /public/unit-categories/:unitId`、`POST /public/questions` は service role で RLS をバイパスするが、**会社PIN検証と紐付いていない**。会社ライセンス（`allowed_unit_ids`）の照合は `QuizSetup.tsx` などフロント側でのみ行われる（`server/index.ts` の該当エンドポイント / `QuizSetup.tsx`）。
  - 影響: API を直接叩けば、PIN未入力のまま**他社ライセンス単元を含む任意単元の全問題（`correctAnswer` 込み）を取得可能**。会社別ライセンス制御が実質無効。
  - 対策: 「PINスコープトークン方式」の**設計のみ**を `docs/DESIGN_S1_pin_scope.md` に定義（オーナー確定「S1は設計のみ・実装は別スケジュール」）。本仕様書時点では未実装。
- **S3（関連）: 会社PINが平文保存・UNIQUE制約なし・試行レート制限なし**（`companies.pin`）。詳細は `docs/DESIGN.md` を参照。
- 認証フロー（招待受諾・パスワード再設定・自己登録・メール認証）は現行UIで未提供であり、送信側機能（招待メール・Forgot・Loginの登録リンク・サインアップ確認メール）がリンク切れ先を指している（§3 参照）。整理は本改修外。
