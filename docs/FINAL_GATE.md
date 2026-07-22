# 最終ゲート手順書(オーナー実施)

作成: 2026-07-22 / 前提: 実装フェーズ完了(PR #1〜#17全マージ、main = faa2873時点)
2段階ゲート(REVIEW_NOTES C2)の第2段階。ここが完了したら改修全体の完了です。

## 0. 事前準備

- [ ] `.env` を用意(リポジトリ直下・gitignore対象)。`npm run test:e2e` は `.env` をsourceするため、
      E2E変数(`E2E_BASE_URL` / `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` / `E2E_USER_EMAIL` / `E2E_USER_PASSWORD` /
      `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`)と、migrate/deploy用の
      `SUPABASE_ACCESS_TOKEN` / `SUPABASE_PROJECT_REF` / `SUPABASE_SERVICE_ROLE_KEY` / `INVITE_REDIRECT_URL` / `CORS_ORIGINS` をここに集約
      (テンプレ名 `.env.e2e.example` とsource対象 `.env` の不整合はR13の是正候補)
- [ ] Playwrightブラウザ未導入なら: `npx playwright install chromium`

## 1. DB移行(3本のmigrationを適用)

**⚠️ 適用前に必ず重複PIN確認**(R09 migrationはこれを怠ると適用失敗):

```sql
select pin, count(*) as n
from public.companies
where pin is not null
group by pin
having count(*) > 1
order by n desc;
```

- 0件 → 次へ
- 1件以上 → どの会社のPINを変えるかを決めて解消(変更前に現行値を控える=上書き前バックアップ)。解消後に次へ

```bash
npm run migrate
```

適用されるmigration:
| ファイル | 内容 |
|---------|------|
| 20260722000000_import_questions.sql | xlsxインポートRPC(単一トランザクション・全件ロールバック) |
| 20260723000000_is_active_rls.sql | is_active実効化(RLSヘルパ強化+profiles with-check凍結) |
| 20260724000000_company_pin_unique.sql | PIN partial UNIQUE + public_action_logs(レート制限台帳) |

適用後の検証SQL(SQL Editor):
```sql
-- RPC存在(prosecdef=tであること)
select proname, prosecdef from pg_proc where proname = 'import_questions';
-- レート制限台帳
select count(*) from public.public_action_logs;
```

## 2. Edge Functionデプロイ

```bash
npm run fn:deploy
```

反映内容: 無効化時のban(R08)/ verify-pin・register-requestレート制限(R09)/ companies楽観ロック(R10)

## 3. フロントデプロイ

mainをpush済みのため、Vercelの自動デプロイ完了を確認(要件①UI・ルート分割・ErrorBoundary等が反映される)

## 4. E2E一括実行

```bash
npm run test:e2e
```

**期待される結果**:
- `questionXlsx.spec.ts` 13件: green(ラウンドトリップ保証)
- `smoke / user / admin / admin-api-auth / functions-routes / admin-invite-user`: green想定。失敗したら該当実装の回帰かenv不備 → 報告
- `register-page.spec.ts`(11件)・`accept-invite-invalid.spec.ts`: **fail確実(既知)** — C1「現状追認」により仕様と乖離したテストのため、**R13を発動してskip化**(オーナー判断済みの整理。実装の欠陥ではない)
- `invite-rate-limit.spec.ts`: 環境によりskip可
- `xlsx-import-export.spec.ts`: 管理者認証があればエクスポート/インポートUI検証。**ラウンドトリップの「実行」まで確認する場合のみ** `E2E_ALLOW_DB_WRITE=1` を付与(全問題のupdated_atが更新されることを許容する場合。推奨は検証環境で実施)

## 5. 手動確認(推奨・本番)

- [ ] 問題管理 → 全件エクスポート → xlsxをExcelで開き12列を確認
- [ ] 無編集で再インポート → プレビューが「新規0件/上書きn件/自動作成なし」
- [ ] 1行だけ編集(誤った正解値等)→ エラー行番号・列名・理由が表示され取込不可
- [ ] verify-pinを11回連続で誤入力 → 429メッセージ
- [ ] デプロイ後、`public_action_logs` の `ip` 列を確認 — `'unknown'` が支配的ならIP制限が全体バケツ化しているため上限見直し(REVIEW_NOTES B10)

## 6. 残オーナー判断(本改修外・別途)

| 事項 | 参照 | 内容 |
|------|------|------|
| Supabaseクライアント軽量化の実装 | docs/spike-supabase-slim.md | gzip -18KB(-46.6%)実証済み。推奨=条件付きでやる(別チケットM規模) |
| S1(公開APIの認可バイパス)の実装 | docs/DESIGN_S1_pin_scope.md | PINスコープトークン方式の設計済み。実装スケジュール判断 |
| 認証フロー送信側のリンク切れ | SPEC.md §3注記 | 招待メール/Forgot/登録リンクが未提供画面を指している。提供再開orリンク撤去の判断 |
| 承認ワークフローの実質バイパス | SPEC.md §7注記 | register-requestが承認なし即時招待。運用意図の確認 |
