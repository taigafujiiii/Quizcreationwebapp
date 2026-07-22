# チケット分割方針(進め方ステップ2)

作成: 2026-07-22 / ステータス: オーナー承認待ち
前提: docs/DESIGN.md(承認済み)に基づく。この段階では ID/名前/目的/依存/順序/並列可否 のみ定義。
詳細(対象ファイル・完了条件・テストコマンド・実装手順)はステップ3(Opus肉付け)で作成する。

## チケット一覧

### フェーズ0: 基盤(直列・最優先)

| ID | 名前 | 目的 | 依存 | 並列 |
|----|------|------|------|------|
| R01 | 死にコード・未使用依存の一括削除 | 未使用依存(MUI/recharts/date-fns等30超)・ui配下未使用28ファイル・mockData/kv_store/Verify/register()を削除し、以降の全作業のノイズを減らす | なし | 不可(package.jsonを触るため先行直列) |
| R02 | tsconfig導入+typecheck整備 | tsconfig.json追加+`npm run typecheck`(tsc --noEmit)導入、既存型エラー解消。以降全チケットの安全網 | R01 | 不可(直列) |
| X01 | xlsx基盤: ライブラリ導入+フォーマット定義 | SheetJS CE 0.20導入(動的import)+`lib/questionXlsx.ts`に列定義・Question⇔行変換・行バリデーション純関数を実装。**フォーマットの単一の真実** | R02 | 不可(package.json+共通定義のため直列) |

### フェーズ1: 要件①(エクスポート→インポートの順)

| ID | 名前 | 目的 | 依存 | 並列 |
|----|------|------|------|------|
| X02 | エクスポート機能 | QuestionsManagementにxlsxエクスポート(全件/絞り込み結果)を追加。出力形式が正 | X01 | X03と並列可(触るファイルが異なる) |
| X03 | インポートRPC(migration) | `import_questions` RPC関数を新設: 単一トランザクションでupsert+単元/カテゴリ自動作成+全件ロールバック。既存テーブル非破壊 | X01 | X02と並列可。ただし他のスキーマ変更チケット(R05/R06)とは直列 |
| X04 | インポートUI | QuestionsManagementにインポートダイアログ(ファイル選択→プレビュー/エラーレポート表示→RPC実行)。ID一致上書き・自動作成プレビュー含む | X02, X03 | 不可(X02と同ファイル) |

### フェーズ2: 要件② パフォーマンス

| ID | 名前 | 目的 | 依存 | 並列 |
|----|------|------|------|------|
| R03 | Context memo化 | AuthContext/CompanyContextのvalueをuseMemo/useCallback化し全画面再レンダー連鎖を解消(P1-3) | R02 | 不可(共通コンポーネントのため直列先行) |
| R04 | ルート分割 | React.lazy+Suspenseで管理系/学生系をコード分割し初回DLを削減(P1-1)。App.tsxにErrorBoundary追加(S7後半)もここで実施 | R03 | 不可(App.tsx集中変更) |
| R05 | Questions画面最適化 | loadData並列化・ミューテーション後の全件再取得→楽観的ローカル更新・名前解決Map化(P2-2〜P2-4) | X04(同ファイルのため), R04 | R06と並列可 |
| R06 | Assignments画面最適化 | フィルタ関数useMemo化・Map化・loadData並列化・楽観的更新(P2-1〜P2-4)。Categories等他画面のloadData並列化も含む | R04 | R05と並列可(ファイル重複なし) |
| R07 | Supabaseクライアント軽量化の技術検証 | 未使用サブクライアント(storage/realtime/functions 計165KB)排除の実現可否をspikeで検証し、結果を報告(P1-2)。実装可否はオーナー判断 | R01 | 常時並列可(調査のみ・コード非変更) |

### フェーズ3: 要件② 堅牢性・セキュリティ

| ID | 名前 | 目的 | 依存 | 並列 |
|----|------|------|------|------|
| R08 | S2: is_active実効化 | RLS関数にis_activeチェック追加・profiles with-check強化(is_active/company_id保護=S4含む)・無効化時セッション失効。migration+Edge Function | X03(スキーマ変更直列) | 不可(スキーマ+server/index.ts) |
| R09 | S3: PIN保護強化 | companies.pin UNIQUE制約+verify-pinレート制限(invite_logs方式)。register-requestレート制限(S6)も同梱 | R08(スキーマ変更直列+server/index.ts共通) | 不可 |
| R10 | 楽観ロック欠落補完+エラー通知 | companies更新に楽観ロック追加(S5)、エラー握りつぶし2箇所にtoast通知(S10)、Result画面のstate未チェック修正(S7前半) | R09(server/index.ts共通) | R11と並列可 |
| R11 | 認証リンク処理の実バグ修正 | 存在しないgetSessionFromUrl呼び出しを正規API(setSession/exchangeCodeForSession)に置換(S8)。パスワード再設定の信頼性回復 | R02 | 常時並列可(ResetPassword/AcceptInviteのみ) |
| R12 | SPEC.md実態反映+S1対策設計書 | PIN方式/companies/公開エンドポイントをSPEC.mdに反映。S1(公開APIの認可バイパス)のPINスコープトークン設計書を作成(実装は本改修外) | なし | 常時並列可(ドキュメントのみ) |

### 条件付きチケット

| ID | 名前 | 目的 | 依存 | 並列 |
|----|------|------|------|------|
| R13 | E2E修復(条件付き) | ステップ5冒頭の既存E2E動作確認で失敗した場合に発動。`.env.e2e` 整備含む | .env.e2e情報の提供 | — |

## 実施順序(全体)

```
直列: R01 → R02 → X01
        ├─ 要件①: X02 ─┬─→ X04 ─→ R05
        │      X03 ─┘        ↑
        ├─ 直列(スキーマ/server): X03 → R08 → R09 → R10
        ├─ 要件②perf: R03 → R04 → (R05 ∥ R06)
        └─ 常時並列: R07, R11, R12
```

- マージ順の衝突源は (a) QuestionsManagement.tsx: X02→X04→R05 の直列、(b) スキーマ+server/index.ts: X03→R08→R09→R10 の直列、(c) App.tsx: R03→R04 の直列。この3ラインを守れば他は並列可
- 各チケットは feature/チケットID ブランチ+単独PR。テスト未通過のマージ禁止(進め方7)
- 要件①(X02〜X04)を要件②より優先着手する(事業上の主目的のため)

## チケット化しない事項(明示)

- S1の実装(設計書のみ=R12)、S12(CORS運用設定・Vercel/Supabase側の設定作業)
- 既存問題データの変更・移行(禁止事項)
- 課題管理の既存CSVインポートの機能変更(現状維持。R06はパフォーマンスのみ)
