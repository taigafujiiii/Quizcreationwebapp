import { expect, test } from '@playwright/test';

test('accept-invite invalid state does not show back-to-login button', async ({ page }) => {
  await page.goto('/accept-invite#');

  await expect(page.getByRole('heading', { name: 'この招待リンクは使用できません' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'ログイン画面に戻る' })).toHaveCount(0);

  // Manual paste fallback should be available.
  await expect(page.getByLabel('招待リンク(URL)を貼り付け')).toBeVisible();
  await expect(page.getByRole('button', { name: '招待リンクを読み込む' })).toBeVisible();
});

