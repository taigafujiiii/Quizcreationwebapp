import { expect, test } from '@playwright/test';

test('unauthenticated user is redirected to login for protected routes', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/login$/);

  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login$/);
});

test('login fails with wrong password', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill('education@maisonmarc.com');
  await page.getByLabel('パスワード').fill('wrong-password');
  await page.getByRole('button', { name: 'ログイン' }).click();

  await expect(page.getByText('ログインに失敗しました')).toBeVisible();
});
