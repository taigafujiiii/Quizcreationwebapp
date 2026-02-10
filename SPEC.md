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
  - DB: `public.units / public.categories / public.questions / public.profiles`
  - Auth: Email/Password + 招待（invite）
  - RLS: `profiles.role` と `profiles.allowed_unit_ids` に基づくアクセス制御
  - Edge Functions: `server`（管理者API）

## 3. ルーティング（主要画面）
### 認証
- `/login` ログイン
- `/accept-invite` 招待登録（招待リンクからの登録、またはリンク手貼り）
- `/verify` メール認証（確認画面）
- `/forgot` パスワード再設定（申請）
- `/reset-password` パスワード更新

### ユーザー
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

## 4. 権限モデル
### 4.1 roles
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

補足:
- RLS再帰（`stack depth limit exceeded`）回避のため、RLSで参照する `is_admin()` / `allowed_unit_ids()` は `SECURITY DEFINER` 関数として実装されます（`supabase/migrations/*fix_rls_stack_depth*.sql`）。

## 5. データモデル（DB）
### 5.1 `public.profiles`
- `id uuid` (PK, `auth.users` 参照)
- `email text`
- `role text` (`user` / `admin`)
- `username text`（最大50文字を想定）
- `allowed_unit_ids uuid[]`（`user` の学習可能単元）
- `is_active boolean`（ソフト削除フラグ）
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

## 8. 管理者API（Supabase Edge Function: `server`）
### 8.1 認証方式
- フロントは Supabase Auth の `access_token` を `Authorization: Bearer <token>` として送信
- 関数内で `adminClient.auth.getUser(token)` し、`profiles.role=admin` を必須チェック

### 8.2 エンドポイント（概要）
- `GET /admin/users`
  - Authユーザー一覧 + profiles情報を統合して返す
- `POST /admin/invite`
  - 招待メール送信（Supabase Admin API）
  - `invite_logs` がある場合は簡易レート制限
- `PATCH /admin/users/:id`
  - `username / role / allowedUnitIds` 更新（入力検証あり）
  - `updatedAt` 指定があれば楽観ロック（不一致は409）
- `POST /admin/users/:id/deactivate`
  - 1回目: `profiles.is_active=false`
  - 2回目: Authから削除

### 8.3 CORS
Edge Functionは `CORS_ORIGINS`（カンマ区切り）を設定可能。
- 未設定の場合は `*`（開発容易性優先）
- 本番はVercelのoriginなど、必要なoriginに限定する

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
