import { expect, test } from '@playwright/test';

const requiredEnv = ['E2E_USER_EMAIL', 'E2E_USER_PASSWORD'];

const ensureEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env: ${missing.join(', ')}. ` +
      'Set them before running Playwright.'
    );
  }
};

const loginAsUser = async (page: any) => {
  ensureEnv();
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(process.env.E2E_USER_EMAIL as string);
  await page.getByLabel('パスワード').fill(process.env.E2E_USER_PASSWORD as string);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/\/$/);
};

test('user can log in and see home', async ({ page }) => {
  await loginAsUser(page);
  await expect(page).toHaveURL(/\/$/);
});

test('user can reach quiz setup and assignment units', async ({ page }) => {
  await loginAsUser(page);

  await page.goto('/quiz/setup');
  await expect(page).toHaveURL(/\/quiz\/setup$/);

  await page.goto('/assignment/units');
  await expect(page).toHaveURL(/\/assignment\/units$/);
});

test('user cannot access admin', async ({ page }) => {
  await loginAsUser(page);
  await page.goto('/admin');
  const start = Date.now();

  while (Date.now() - start < 10_000) {
    const currentUrl = page.url();

    if (currentUrl.endsWith('/login') || currentUrl.endsWith('/')) {
      return;
    }

    if (currentUrl.includes('/admin')) {
      const isAdminVisible = await page
        .getByRole('heading', { name: '管理者ダッシュボード' })
        .isVisible()
        .catch(() => false);

      if (isAdminVisible) {
        throw new Error(
          '一般ユーザーが管理者権限になっています。profiles.role を user に修正してください。'
        );
      }
    }

    await page.waitForTimeout(500);
  }

  throw new Error('一般ユーザーが /admin に滞留しています。リダイレクト設定を確認してください。');
});
