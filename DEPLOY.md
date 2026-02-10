# Deployment Guide (Vercel + Supabase)

## 1. Supabaseプロジェクト作成
- Supabaseで新規プロジェクトを作成。
- Project URL と anon key を控える。

## 2. DBスキーマと初期データ
1. SupabaseのSQL Editorで以下を順に実行:
   - `supabase/migrations/20260206000000_init.sql`
   - `supabase/seed.sql`
2. データが投入されたことを確認（units / categories / questions）。

## 3. 認証設定
- Auth > Settings
  - Site URL: デプロイ先のURL
  - Redirect URLs: 
    - `https://<your-domain>/accept-invite`
    - `https://<your-domain>/reset-password`
    - `https://<your-domain>/verify`
- Auth > Providers > Email
  - 本番運用の場合はSMTP設定を推奨
- Auth > Settings
  - Invite制にしたい場合: "Enable email signups" を OFF

## 4. Edge Function (管理者API)
- Supabase CLI or Dashboardで `supabase/functions/server` をデプロイ
- Function環境変数
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `INVITE_REDIRECT_URL` (例: `https://<your-domain>/accept-invite`)

## 5. 初期管理者の作成
1. 管理者招待からメールを送信（`role=admin` で作成されます）
2. 招待リンクから登録完了後、管理者としてログイン可能

## 6. Vercelデプロイ
- Vercelにリポジトリを接続
- 環境変数を設定
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Build command: `npm run build`
- Output: `dist`
- SPAルーティングは `vercel.json` の rewrite で対応済み

## 7. 動作確認
- ログイン
- 管理者画面で単元/カテゴリ/問題/課題/ユーザー管理が操作できること
- 招待メールから登録できること
- 自由演習/課題コースでクイズが出題されること
