// X02/X04: 問題管理画面の xlsx エクスポート/インポート UI の E2E(最終ゲート用)
// - 要 E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD(未設定時は skip = register-api.spec.ts と同じ graceful 方針)
// - X02/X04 実装前は UI 要素が無く fail する(テストファースト)。実装ブランチで green にすること。
import { test, expect, type Page } from '@playwright/test';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? '';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? '';
const hasCreds = Boolean(ADMIN_EMAIL && ADMIN_PASSWORD);

async function loginAsAdmin(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/メールアドレス|email/i).fill(ADMIN_EMAIL);
  await page.getByLabel(/パスワード|password/i).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /ログイン/ }).click();
  await page.waitForURL(/\/(admin)?$/, { timeout: 15_000 });
}

test.describe('xlsx import/export (QuestionsManagement)', () => {
  test.skip(!hasCreds, 'E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD 未設定のため skip(.env.e2e 配置後に実行)');

  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await page.goto('/admin/questions');
  });

  test('エクスポート2ボタンが表示され、全件エクスポートで xlsx がダウンロードされる(X02)', async ({ page }) => {
    await expect(page.getByRole('button', { name: '全件エクスポート' })).toBeVisible();
    await expect(page.getByRole('button', { name: '絞り込み結果をエクスポート' })).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '全件エクスポート' }).click();
    const download = await downloadPromise;
    // ファイル名規則: questions_YYYYMMDD_HHmm.xlsx(X02 完了条件)
    expect(download.suggestedFilename()).toMatch(/^questions_\d{8}_\d{4}\.xlsx$/);
  });

  test('インポートダイアログ: 不正ファイルでエラー一覧、取込ボタン無効(X04)', async ({ page }) => {
    await page.getByRole('button', { name: 'xlsxインポート' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    // 壊れた xlsx(ただのテキスト)を投入 → 読み込み失敗エラーが表示され、取込不可
    await page.getByRole('dialog').locator('input[type="file"]').setInputFiles({
      name: 'broken.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('this is not an xlsx file'),
    });
    await expect(page.getByRole('dialog').getByText(/読み込みに失敗|エラー/)).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('button', { name: /^インポート$/ })).toBeDisabled();
  });

  test('ラウンドトリップ(UI): エクスポート→無編集で再インポート→全行「上書き」プレビュー→成功(X04完了条件)', async ({ page }) => {
    // 1) エクスポートを取得
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: '全件エクスポート' }).click();
    const download = await downloadPromise;
    const filePath = await download.path();
    expect(filePath).toBeTruthy();

    // 2) 無編集で再インポート
    await page.getByRole('button', { name: 'xlsxインポート' }).click();
    await page.getByRole('dialog').locator('input[type="file"]').setInputFiles(filePath!);

    // 3) プレビュー: 新規0件・全行上書き・自動作成なし(= 実質 no-op)
    await expect(page.getByRole('dialog').getByText(/新規\s*0\s*件/)).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/上書き\s*[1-9]\d*\s*件/)).toBeVisible();
    await expect(page.getByRole('dialog').getByText(/自動作成される単元/)).toHaveCount(0);
    await expect(page.getByRole('dialog').getByText(/自動作成されるカテゴリ/)).toHaveCount(0);

    // 4) 実行 → 成功トースト(新規0件)
    // 注意: no-op上書きでも全行の updated_at がトリガで更新される(=既存データのメタデータ変更)。
    // 本番URL相手に黙って書き込まないよう、実行ステップは E2E_ALLOW_DB_WRITE=1 の明示時のみ
    // (検証環境 or オーナーが更新を許容した場合)。未設定時はプレビュー検証までで完了とする。
    if (process.env.E2E_ALLOW_DB_WRITE === '1') {
      await page.getByRole('dialog').getByRole('button', { name: /^インポート$/ }).click();
      await expect(page.getByText(/インポート完了: 新規0件/)).toBeVisible({ timeout: 20_000 });
    } else {
      await expect(page.getByRole('dialog').getByRole('button', { name: /^インポート$/ })).toBeEnabled();
      await page.getByRole('dialog').getByRole('button', { name: /キャンセル/ }).click();
    }
  });
});
