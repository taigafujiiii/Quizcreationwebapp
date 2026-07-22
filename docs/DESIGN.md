# 改修設計方針書 — xlsxインポート/エクスポート + リファクタリング

作成: 2026-07-22 / ステータス: **承認済み(2026-07-22 オーナー承認)**

確定事項(オーナー決定):
- 設計方針全体を承認(xlsxフォーマット12列・SheetJS CE 0.20・RPC全件ロールバック・リファクタリング実施方針)
- 重複判定: **ID一致→上書き**(ID空=新規追加、ID有り+DB不存在=行エラー)
- 単元・カテゴリ未存在時: **両方自動作成**(既存CSVインポートと同挙動)
- セキュリティHigh: **S1は設計のみ(本改修では実装しない)、S2/S3は実装する**

追記(2026-07-22 ステップ4レビュー裁定・docs/REVIEW_NOTES.md参照):
- 課題フラグ(is_assignment): xlsx列に含めない。新規=false固定・上書き時=既存値維持(確定)
- 回答方式列の空欄は行エラー(既存CSVの「空欄=checkbox既定」は踏襲しない)
- インポートRPC入力に `row_number`(元シート行番号)を付加フィールドとして含める
- 無効化時セッション失効はban方式(`updateUserById(ban_duration)`)。`admin.signOut(userId)`というAPIは存在しない
- P2-3の「両画面7箇所で全件再取得」は一部旧実装ベースの記述。Assignments側の対話系ミューテーションは実装済みの楽観更新を維持し、Questions側の未楽観化箇所(作成/更新/削除/一括削除)のみR05で改修

## 前提(コード調査で確定した事実)

- DB `questions`: `option_a〜d` の固定4列、`correct_answer` はCHECK制約 `^[ABCD](,[ABCD])*$`、`answer_method` は `radio` / `checkbox`
- DB→アプリ型変換はSupabaseの `select('camelCase:snake_case')` エイリアスで実施(専用変換関数なし)
- 既存CSVインポートは課題管理(AssignmentsManagement.tsx:628-978)のみ。日本語ヘッダー名でマッチング(順不同)、パース段階で全行バリデーション→1件でもNGなら取込不可(全件中断)。単元/カテゴリは名前解決+未存在なら自動作成。insertは100件バッチ
- 既存実装の弱点: バッチ途中でエラー時、それ以前のバッチはDBに残る(厳密な全件アトミックではない)
- エクスポート機能は存在しない(テンプレートDLのみ)
- 楽観ロック: 更新系は `updated_at` 一致条件付きupdateで競合検知(全管理画面共通パターン)

---

## 要件① 4択問題のxlsxインポート/エクスポート

### 1. 実装順序とフォーマットの正

要件通り「エクスポート → インポート」の順で実装し、**エクスポートの出力列定義を単一の真実**とする。
列定義は `src/app/lib/questionXlsx.ts`(新設)に定数として一元定義し、エクスポート・インポート・テストが同じ定義を参照する。

### 2. xlsx列フォーマット(提案)

| # | 列名 | 必須 | 値 |
|---|------|------|-----|
| 1 | ID | エクスポート時出力 / インポート時任意 | 問題UUID。空=新規 |
| 2 | 単元 | ○ | 単元名 |
| 3 | カテゴリ | ○ | カテゴリ名(例: CCNA-13) |
| 4 | 問題文 | ○ | テキスト |
| 5 | 選択肢A | ○ | テキスト |
| 6 | 選択肢B | ○ | テキスト |
| 7 | 選択肢C | ○ | テキスト |
| 8 | 選択肢D | ○ | テキスト |
| 9 | 正解 | ○ | radio: `A` / checkbox: `A,C`(昇順正規化) |
| 10 | 回答方式 | ○ | `radio` / `checkbox`(日本語表記も受理) |
| 11 | 解説 | - | テキスト(空可) |
| 12 | 公開 | - | `公開` / `非公開`(空=公開) |

- **選択肢は分割4列**を採用(DBが固定4列であり、Excel編集時の事故が最少。1セル区切り案は区切り文字が本文に含まれるリスクがあり不採用)
- 列名・値表現は既存CSVインポートの日本語ヘッダー・値パーサーを踏襲(運用の一貫性)
- 対象は既存問題管理画面のスコープ全体(課題フラグは列に含めず、既存値を維持。新規は false)→ 要確認

### 3. インポート仕様(要確認ポイント)

1. **重複判定**: ID列で判定。ID有り+DB存在→**上書き(update)**、ID空→**新規追加**、ID有り+DB不存在→エラー(行番号付き)
2. **カテゴリ未存在時**: 既存CSVと同様に**単元・カテゴリとも名前解決+自動作成**(CCNA-13等の新カテゴリ一括投入の運用に適合) / 代替案: カテゴリのみ自動作成・単元はエラー
3. **エラー時挙動**: 全件ロールバック。実装はPostgres RPC関数(`import_questions`)を新設し**単一トランザクションで一括upsert**(既存CSVの「バッチ途中失敗で中途半端に残る」問題を構造的に解消)。スキーマ変更は関数追加のみで既存データ・既存テーブルに非破壊(後方互換)
4. **バリデーション**(パース段階・DB書き込み前に全行実施):
   - 必須列の存在チェック(ヘッダー行)
   - 行単位: 必須項目、正解形式(radio=単一/checkbox=カンマ区切り・A-D範囲)、回答方式の値、正解と回答方式の整合
   - エラーレポート: 「N行目 / 列名 / 理由」の一覧をダイアログ内に表示(既存UIパターン踏襲: 最大20件+ほかN件)
5. **ラウンドトリップ保証**: エクスポート→無編集で再インポート→全行「ID一致・全フィールド一致の上書き(実質no-op)」になることをテストで担保

### 4. xlsxライブラリ選定(禁止事項の例外適用・理由付き)

| 候補 | 評価 |
|------|------|
| **SheetJS CE 0.20.x(cdn.sheetjs.com配布のtgz)** ✅推奨 | デファクト標準。読み書き両対応。npmレジストリ版0.18.5は既知脆弱性未修正のため、公式CDN配布の0.20.x(修正済み・Apache-2.0)をpackage.jsonにtgz URL指定で導入 |
| exceljs | 機能過剰(スタイル・ストリーム)でバンドル+約250KB。読み書きだけには重い |
| read-excel-file / write-excel-file | 軽量だが2パッケージ分割・スキーマAPIが独自で、string[][]往復には遠回り |

- 動的import(`await import('xlsx')`)で遅延読み込みし、メインバンドルに載せない

### 5. 実装配置

- `src/app/lib/questionXlsx.ts`(新設): 列定義・Question[]⇔xlsx変換・行バリデーション(純関数、テスト対象)
- `src/app/components/admin/QuestionsManagement.tsx`: エクスポートボタン(絞り込み結果 or 全件)+インポートダイアログを追加
- 既存CSVインポート(課題管理)は現状維持(スコープ外、壊さない)

### 6. テスト方針

- ラウンドトリップテスト: `questionXlsx.ts` の純関数に対し Playwright テストランナー(Node実行)で実施 → **新規テストランナー(vitest等)の追加不要**
- E2E: 管理画面でエクスポート→ダウンロード検証、インポートダイアログのエラー表示検証
- 既存 tests/e2e の動作確認を最初に実施(要 .env.e2e — オーナーに認証情報の所在を確認)

---

## 要件② リファクタリング

優先順位: パフォーマンス > 堅牢性 > セキュリティ > 可読性。外部から見た挙動(画面・機能)は変えない。

### 前提となる重要発見: SPEC.mdと実装の乖離

現在の実装はSPEC.md記載の「Email/Password + 招待」モデルから進化しており、
**会社PIN方式の公開フロー**(`companies` / `registration_requests` / Edge Function `/public/*`)が追加されている。
SPEC.mdはこの変更を反映していない。リファクタリング時のSPEC.md更新もスコープに含めることを推奨。

### セキュリティ・堅牢性診断結果(確定)

**[High] 3件 — 事業モデルに関わる構造的欠陥**

| # | 問題 | 根拠 | 失敗シナリオ |
|---|------|------|--------------|
| S1 | `/public/quiz-data` `/public/unit-categories/:unitId` `/public/questions` が認証・PIN検証と紐付いておらず、**認証なしで任意単元の全問題(正解込み)を取得可能**。`allowedUnitIds` の制御はフロントのみ | server/index.ts:148-240, QuizSetup.tsx:47-50, App.tsx:42-49 | API直叩きでPIN未入力のまま他社ライセンス単元の問題・正解を全取得。会社別ライセンス制御が実質無効 |
| S2 | アカウント無効化(`is_active`)がRLS関数(`is_admin()`/`allowed_unit_ids()`)で未参照。profiles UPDATEのwith-checkが`is_active`を保護せず**本人が自己復活可能**。無効化時のセッション失効処理もなし | fix_rls_stack_depth.sql:4-33, init.sql:131-141, server/index.ts:749-800 | 削除済みユーザーがrefresh tokenで継続アクセス、または自分で`is_active=true`に書き戻し |
| S3 | 会社PINが**平文保存・UNIQUE制約なし・試行レート制限なし** | company_pin.sql, server/index.ts:148-167 | PIN総当たりで他社情報取得。重複PIN設定時は両社ともログイン不能(maybeSingle複数ヒット) |

**[Med] 4件**

- S4: profiles with-checkが `company_id`/`email`/`username` を未保護(自社偽装の余地)
- S5: 楽観ロックがcompaniesのみ欠落(adminApi.ts:167-172, server/index.ts:355-392)— 他画面は一貫実装済み
- S6: `/public/register-request` にレート制限なし+毎回 `listUsers({perPage:1000})` 実行(招待メール爆撃・クォータ枯渇)
- S7: Result画面が `location.state` 未チェックで更新/直アクセス時に白画面クラッシュ(Result.tsx:14-17)。ErrorBoundaryも無し

**[Low] ほか**

- S8: `getSessionFromUrl` は supabase-js 2.56.0 に存在しないAPI(ResetPassword.tsx:28, AcceptInvite.tsx:88)— パスワード再設定が特定リンク形式で失敗する実バグ
- S9: **tsconfig.json不在・型チェックがビルドに存在しない**(S8が検出されなかった根本原因)→ `tsc --noEmit` の導入を推奨
- S10: エラー握りつぶし2箇所(CompaniesManagement.tsx:39-44, UsersManagement.tsx:72-93)— 他画面は `toast.error` 一貫
- S11: 死にコード: mockData.ts(参照ゼロ)、kv_store.ts、Verify.tsx(ルート未登録)、AuthContext.register()
- S12: CORS未設定時 `*`、/public/companiesがDBエラーメッセージを素通し

### セキュリティ修正のスコープ判断(オーナー確認ポイント)

S1〜S3の修正はEdge Function/マイグレーション変更を伴い「外部から見た挙動を変えない」原則と一部緊張する
(正規UIフローの見た目は不変だが、API直叩きの挙動は変わる。PINスコープトークン導入はフロント改修も必要)。
**推奨: S2/S3/S5〜S10は本改修に含める(正規フロー挙動不変)。S1(PINスコープトークン設計)は
影響範囲が大きいため、本改修では設計のみ行い実装は別スケジュール判断**。

### パフォーマンス診断結果(計測済み)

**ビルド実測**: 単一JSチャンク 671KB(gzip 192KB)+CSS 101KB。コード分割ゼロ(React.lazy/dynamic import使用0件)。
Vite警告「500KB超チャンク」発生中。

**[P1] 3件**

| # | 問題 | 根拠 | 対策 |
|---|------|------|------|
| P1-1 | ルート分割皆無。学生ユーザーも管理画面全部(AssignmentsManagement 1849行含む)をDL | App.tsx:1-19 全13ルート静的import | React.lazy+Suspenseで最低限 管理系/学生系の2分割 |
| P1-2 | Supabase SDKの未使用サブクライアント同梱: storage-js 84KB+realtime-js 73KB+functions-js 7.5KB(計約165KB圧縮前、バンドルの10%強)。`supabase.storage/channel/functions.invoke`の使用0件 | visualizer実測 | auth-js+postgrest-js直接利用の技術検証チケットを先行 |
| P1-3 | AuthContext/CompanyContextのProvider valueが毎レンダー新規オブジェクト(useMemo/useCallbackなし)。ルート全体を包むため全画面に再レンダー連鎖 | AuthContext.tsx:185, CompanyContext.tsx:46 | value をuseMemo化・関数をuseCallback化 |

**[P2] 4件**

- P2-1: AssignmentsManagementのフィルタ関数が非メモ化かつレンダーごと2回実行(:342-381, 呼び出し:1476/1495/1571/1587)。QuestionsManagementはuseMemo化済みで実装差が明確
- P2-2: getCategoryName/getUnitName系がテーブル行ごとにO(n)線形探索(両画面)→ Map化でO(1)に
- P2-3: 全ミューテーション後にloadData()全件再取得(両画面とも7箇所)。公開トグル1個で3テーブル再取得 → 楽観的ローカル更新+失敗時ロールバックに変更
- P2-4: loadDataのクエリが直列await(Questions/Assignments/Categories)。UsersManagementはPromise.all使用済み → 横展開

**[P3]**: CSVインポートの直列ループ(ensureUnit/Category)、UnitCard/CategoryChipの非React.memo

**未使用依存(バンドル混入ゼロだがnode_modules肥大・誤使用リスク)**

- 完全未使用で削除可: MUI一式(@mui/material, @mui/icons-material, @emotion×2)、recharts、date-fns(36MB)、react-hook-form、react-dnd×2、motion、react-slick、embla-carousel、masonry、react-day-picker、cmdk、vaul、input-otp、react-resizable-panels、@popperjs/react-popper、未使用Radix 15パッケージ
- ui/配下46ファイル中**28ファイルが参照ゼロ**(shadcn雛形の残骸)→ 削除
- npm installで脆弱性警告12件(critical 1/high 8)→ 依存削減後にnpm audit再評価

---

## リファクタリング実施方針(優先順位順)

1. **パフォーマンス**: P1-1(ルート分割)→ P1-3(Context memo化)→ P2-1〜P2-4 → P1-2(技術検証次第)
2. **堅牢性**: S5(companies楽観ロック)、S7(Resultクラッシュ+ErrorBoundary)、S8(存在しないAPI呼び出し修正)、S9(tsconfig+typecheck導入)、S10(エラー通知2箇所)
3. **セキュリティ**: S2(is_active RLS+セッション失効)、S3(PIN UNIQUE+レート制限)、S4/S6。S1はオーナー判断
4. **可読性**: S11死にコード削除(mockData/kv_store/Verify/register/未使用ui 28+未使用依存)、SPEC.md実態反映

検証方法: 各変更前後で `npm run build` のチャンクサイズ比較+E2Eスモーク。挙動変更ゼロが原則。
