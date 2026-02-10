# クイズ学習システム テスト仕様書（実行手順つき）

このドキュメントは「E2Eテストを実行できること」と「本番での手動確認観点」をまとめます。

## 1. テストの種類
- E2E自動テスト（Playwright）
  - `tests/e2e/*.spec.ts`
  - 本番URL（Vercel）を対象に実行する想定
- 手動テスト（補助）
  - リリース前の最終確認

## 2. 前提条件
- Node.js + npm
- `npm i` 済み
- Playwrightブラウザがインストール済み
  - 未導入の場合: `npx playwright install`
- テスト対象環境（通常は本番）
  - Vercelにデプロイ済み
  - Supabase Edge Function `server` がデプロイ済み
- テスト用アカウントが存在すること
  - 管理者（`profiles.role=admin`）
  - 一般ユーザー（`profiles.role=user`）

## 3. 環境変数（E2E）
E2Eは `.env.e2e` を読み込みます（`package.json` の `test:e2e` を参照）。

`.env.e2e` は git 管理しません（`.gitignore` 対象）。

テンプレート: `.env.e2e.example`

### 3.1 `.env.e2e` 例
```bash
E2E_BASE_URL=https://<your-vercel-domain>
E2E_ADMIN_EMAIL=<admin-email>
E2E_ADMIN_PASSWORD=<admin-password>
E2E_USER_EMAIL=<user-email>
E2E_USER_PASSWORD=<user-password>
VITE_SUPABASE_URL=https://<your-project-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
```

## 4. E2E（Playwright）実行方法
### 4.1 通常実行
```bash
npm run test:e2e
```

### 4.2 監視実行（ファイル変更で再実行）
```bash
npm run test:e2e:watch
```

### 4.3 実行パラメータ（任意）
`playwright.config.ts` に従い、以下が利用可能です:
- `E2E_BASE_URL`（テスト対象URL）
- `E2E_BROWSER`（`chromium`/`firefox`/`webkit`）
- `E2E_USE_CHROME=1`（Chrome channelで起動）
- `E2E_HEADFUL=1`（ヘッドレス無効）

例:
```bash
E2E_HEADFUL=1 E2E_USE_CHROME=1 npm run test:e2e
```

## 5. 自動テストのカバレッジ（概要）
`tests/e2e` は主に以下を確認します:
- 未ログイン時の保護ルートリダイレクト（`/`, `/admin`）
- ログイン失敗時の表示
- 一般ユーザーで管理画面へ入れないこと
- 管理者ログインと管理ページ遷移のスモーク
- Supabase Edge Function（`server`）のルート存在確認（preflight/OPTIONS）
- 管理者APIのBearerトークン認可（`/admin/users`）
- 招待API呼び出し成功（メール配信までは検証しない）
- 招待APIの簡易レート制限（環境によってはskip）

## 6. 手動テスト観点（本番）
自動化されていないが、仕様上重要な観点:

### 6.1 権限
- `user` は `allowed_unit_ids` 外の単元が閲覧できない（自由演習の選択肢 / 課題の単元一覧）
- `user` は `/admin` 以下へアクセスできない

### 6.2 クイズ（回答方式）
- `radio` 問題: 1つだけ選択でき、結果判定が正しい
- `checkbox` 問題: 複数選択でき、`correct_answer`（例 `A,B`）と一致で正解になる
- 「わからない」選択時は不正解扱いになる

### 6.3 管理画面（同時編集）
複数管理者で同じレコードを編集した場合:
- 後から保存した側が無条件で上書きされない（`updated_at` の競合検知で弾かれる）
- 競合メッセージが出たら再読み込みで復帰できる

### 6.4 CSVインポート（課題）
- `回答方式=radio` の `正解` は `A|B|C|D`
- `回答方式=checkbox` の `正解` は `A,B` のようなカンマ区切り

## 7. トラブルシュート
### 7.1 テストがログインで落ちる
- `.env.e2e` の `E2E_*_EMAIL/PASSWORD` を確認
- 対象環境のユーザーが `profiles.is_active=true` か確認

### 7.2 管理者APIが403になる
- 該当ユーザーの `profiles.role` が `admin` か確認
- Edge Function `server` がデプロイされているか確認

### 7.3 Functions のCORS preflightが失敗する
- Supabase Secrets の `CORS_ORIGINS` に対象originが入っているか確認
