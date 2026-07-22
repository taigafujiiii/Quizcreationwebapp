# チケットレビュー記録(進め方ステップ4 / 2026-07-22)

レビュー結果: **15チケット全件承認(差し戻しなし)**。ただし以下の裁定が各チケットに対して**拘束力を持つ**。
実装時(ステップ6)は担当チケット+本ファイルを必ず併読すること。チケット本文と本裁定が矛盾する場合は本裁定が優先。

## 裁定(技術判断・確定)

### 要件①: xlsx関連

| # | 論点 | 裁定 |
|---|------|------|
| A1 | X01⇔X02のエクスポートAPI齟齬 | **X01のAPIが正**。X02は `buildQuestionsWorkbook(questions, {categories, units})` を呼ぶ(名前解決はX01内部)。X02手順2の `buildExportInputs`/`QuestionExportInput` は実装しない。解決不能時の `'不明'` フォールバックはX01の `questionsToAoa` 内に実装(FK制約により通常発生しないが、'不明'名のままインポートするとカテゴリが自動作成されるリスクをX01備考に記録) |
| A2 | X01⇔X04のインポートAPI齟齬 | X01に合成関数 `parseQuestionsXlsx(data: ArrayBuffer): Promise<{rows, errors}>`(= xlsxBytesToAoa + parseAoaToRows の合成)を**追加**する。エラー型はX01の `RowError {row, column, reason}` が正(`message` フィールドは持たない)。X04は表示時に `行${row}: [${column}] ${reason}` を自前整形 |
| A3 | ID行分類の重複実装 | X04手順3の独自 `idErrors` フィルタ・手順4の newCount/updateCount 集計は、X01の `classifyRows(rows, existingIds)` を使って導出する(重複実装禁止) |
| A4 | ParsedQuestionRow.id の型 | X01の `id: string`(空文字=新規)が正。X04のRPC送出時は `id: r.id === '' ? null : r.id` |
| A5 | 正解の昇順正規化の所在 | **X01に集約**。エクスポート(`questionsToAoa`)とインポート(`parseAoaToRows`)の両方でX01の `normalizeCorrectAnswer` を通す。X02/X03/X04は追加正規化しない(X03 RPCは無加工でINSERT/UPDATE) |
| A6 | RPCでの形式二重検証 | **行わない**(X03記載の通り)。DB CHECK制約(correct_answer正規表現/answer_method)が最終安全網。ID不存在の明示例外はX03手順4cの通り実装 |
| A7 | row_number伝達 | **採用**。X04は各行に `row_number` を含めて送出、X03はordinalityフォールバック付きで使用 |
| A8 | RPCパラメータ名 | `p_rows` で確定(X03/X04両方) |
| A9 | 回答方式の空欄 | **空欄=行エラー**(列定義の必須○が正)。既存CSVパーサの「空欄=checkbox既定」は踏襲しない |
| A10 | is_assignment | **確定**: xlsx列に含めない。新規insert=false固定、ID上書き時=既存値維持(カラムに触らない)。DESIGN.mdの「→要確認」表記は解消 |
| A11 | エクスポートUI | 2ボタン方式(全件/絞り込み結果)で確定。dropdown-menuへの集約はしない |
| A12 | RPCのupdateに楽観ロック | 付けない(X03記載の通り)。一括インポートは「まとめて上書き」が意図。プレビューで上書き件数を明示することで担保 |

### 要件②: リファクタリング関連

| # | 論点 | 裁定 |
|---|------|------|
| B1 | R02のS8境界 | `@ts-expect-error + TODO(R11/S8)` 方式で確定(R02は抑制のみ、実修正はR11)。excludeは不採用 |
| B2 | R02のnoUnused* | 初回無効で確定。後続チケット完了後の引き上げは将来課題 |
| B3 | R03のregister | R01先行が確定順序のため対象外(R01未取込ブランチで作業しないこと) |
| B4 | R04の30%削減目標 | 「未達時は実測値+原因報告で完了」で確定。原因がP1-2(supabase-js)ならR07報告書に接続 |
| B5 | R05のinsert .select()追加 | **採用**(返却行で楽観反映・updatedAt取得必須)。「作成のみloadData許容」案は不採用 |
| B6 | R06のCSVインポート後loadData | 現状維持で確定(機能仕様変更禁止)。CategoriesのgetUnitName Map化は任意のまま |
| B7 | R07のrpc対応 | 互換ラッパー見積もりに `.rpc()` を**含める**。計測方法はR04と統一(vite buildのgzip値) |
| B8 | R08のセッション失効方式 | **ban方式**(`admin.updateUserById(userId, {ban_duration: '876000h'})`)で確定。GoTrue REST直叩きは不採用。将来のreactivate時は `ban_duration: 'none'` の申し送りをコード内コメントに残す |
| B9 | R09のログテーブル | `public_action_logs` 新設で確定(invite_logsは流用しない) |
| B10 | R09のIP取得 | 実装時に `x-forwarded-for` の実態を検証し、IPが取れない環境では email主・IP従+保守的上限(verify-pinは上限値を厳しめ)とし、検証結果をPRに記録 |
| B11 | R09のPINハッシュ化 | スコープ外で確定(S1設計書=R12で言及) |
| B12 | R09の重複PIN検出時 | チケット記載の通り**オーナー報告・指示待ち**(勝手に変更しない)。バックアップ必須方針に従う |

## オーナー判断(2026-07-22 確定)

- **C1: 認証フローのルート未登録 → 現状追認(PIN方式のみ)で確定**。ルート復旧はしない(R14は起票しない)
  - R11のスコープ調整: 存在しないAPI呼び出しの除去は実施(型健全化・到達不能でも低リスク)。ルート登録は行わない
  - R13/E2E: `register-page.spec.ts`(11件)・`accept-invite-invalid.spec.ts` は現仕様乖離として `test.skip`+理由コメントで整理(仕様通り)
  - R12/SPEC: 招待受諾・パスワード再設定・自己登録は「**現行UIでは未提供**」と事実記載。招待メール送信・Forgot・Loginの登録リンクなど**送信側機能がリンク切れ先を指している既知の課題**として明記(その整理は本改修外・別途検討)
- **C2: E2Eマージゲート → 2段階ゲートで確定**
  - 必須ゲート(全チケット): `npm run typecheck` + `npm run build` + ローカル実行可能テスト(ラウンドトリップ含む)
  - 最終ゲート: .env.e2e 配置後に本番対象E2Eを一括実施(Edge Function/migrationデプロイ後)。全green確認をもって改修完了とする
