import { expect, test } from '@playwright/test';

const requiredEnv = ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'];

const ensureEnv = () => {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required env: ${missing.join(', ')}. ` +
      'Set them before running Playwright.'
    );
  }
};

const loginAsAdmin = async (page: any) => {
  ensureEnv();
  await page.goto('/login');
  await page.getByLabel('メールアドレス').fill(process.env.E2E_ADMIN_EMAIL as string);
  await page.getByLabel('パスワード').fill(process.env.E2E_ADMIN_PASSWORD as string);
  await page.getByRole('button', { name: 'ログイン' }).click();
  await expect(page).toHaveURL(/\/admin$/);
};

test('admin can log in and see dashboard', async ({ page }) => {
  await loginAsAdmin(page);
  await expect(page.getByRole('heading', { name: '管理者ダッシュボード' })).toBeVisible();
});

test('admin can open management pages (read-only smoke)', async ({ page }) => {
  await loginAsAdmin(page);

  const pages = [
    { path: '/admin/units', title: '単元管理', heading: '単元管理' },
    { path: '/admin/categories', title: 'カテゴリ管理', heading: 'カテゴリ管理' },
    { path: '/admin/questions', title: '問題管理', heading: '問題管理' },
    { path: '/admin/assignments', title: '課題管理', heading: '課題管理' },
    { path: '/admin/users', title: 'ユーザー管理', heading: 'ユーザー管理' },
  ];

  await loginAsAdmin(page);

  for (const item of pages) {
    await expect(page.getByRole('heading', { name: '管理者ダッシュボード' })).toBeVisible({ timeout: 20_000 });
    await page.getByText(item.title, { exact: false }).first().click();
    await expect(page).toHaveURL(new RegExp(`${item.path}$`));
    await expect(page.getByText(item.heading, { exact: false })).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: 'ホーム' }).click();
    await expect(page).toHaveURL(/\/admin$/);
  }
});
