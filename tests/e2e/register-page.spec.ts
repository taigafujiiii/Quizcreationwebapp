/**
 * Self-registration page UI tests
 *
 * Runs against a local Vite dev server (http://localhost:5173) so the new
 * /register route is always available regardless of deployment state.
 *
 * Supabase function calls are intercepted with Playwright route mocking so
 * the tests work even without network access to Supabase.
 */
import { expect, test } from '@playwright/test';

const LOCAL_BASE = 'http://localhost:5173';

/** Intercept all Supabase Edge Function calls for the /public/companies endpoint */
const mockCompanies = async (page: any) => {
  await page.route('**/functions/v1/server/public/companies', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: '00000000-0000-4000-8000-000000000001', name: 'テスト株式会社' },
        { id: '00000000-0000-4000-8000-000000000002', name: 'サンプル商事' },
      ]),
    });
  });
};

/** Intercept the register-request endpoint and return success */
const mockRegisterSuccess = async (page: any) => {
  await page.route('**/functions/v1/server/public/register-request', (route: any) => {
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true }),
    });
  });
};

/** Intercept the register-request endpoint and return an error */
const mockRegisterError = async (page: any, errorMsg: string, status = 409) => {
  await page.route('**/functions/v1/server/public/register-request', (route: any) => {
    route.fulfill({
      status,
      contentType: 'application/json',
      body: JSON.stringify({ error: errorMsg }),
    });
  });
};

// ---------------------------------------------------------------------------
// Accessibility: /register page is public
// ---------------------------------------------------------------------------

test('/register is accessible without authentication', async ({ page }) => {
  await mockCompanies(page);
  await page.goto(`${LOCAL_BASE}/register`);
  await expect(page).toHaveURL(/\/register$/);
});

test('/register shows page heading', async ({ page }) => {
  await mockCompanies(page);
  await page.goto(`${LOCAL_BASE}/register`);
  await expect(page.getByRole('heading', { name: 'アカウント登録' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Form fields
// ---------------------------------------------------------------------------

test('/register shows all required input fields', async ({ page }) => {
  await mockCompanies(page);
  await page.goto(`${LOCAL_BASE}/register`);
  await expect(page.getByLabel('姓 *')).toBeVisible();
  await expect(page.getByLabel('名 *')).toBeVisible();
  await expect(page.getByLabel('メールアドレス *')).toBeVisible();
  await expect(page.getByLabel('所属会社 *')).toBeVisible();
});

test('/register shows submit button', async ({ page }) => {
  await mockCompanies(page);
  await page.goto(`${LOCAL_BASE}/register`);
  await expect(page.getByRole('button', { name: '登録する' })).toBeVisible();
});

test('/register: company dropdown is populated from API', async ({ page }) => {
  await mockCompanies(page);
  await page.goto(`${LOCAL_BASE}/register`);
  const selectTrigger = page.getByRole('combobox');
  await expect(selectTrigger).toBeEnabled({ timeout: 10_000 });
  await selectTrigger.click();
  await expect(page.getByRole('option', { name: 'テスト株式会社' })).toBeVisible();
  await expect(page.getByRole('option', { name: 'サンプル商事' })).toBeVisible();
});

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

test('/register has link back to /login', async ({ page }) => {
  await mockCompanies(page);
  await page.goto(`${LOCAL_BASE}/register`);
  const loginLink = page.getByRole('link', { name: 'ログイン' });
  await expect(loginLink).toBeVisible();
  await loginLink.click();
  await expect(page).toHaveURL(/\/login$/);
});

test('/login page has "登録申請" link to /register', async ({ page }) => {
  await page.goto(`${LOCAL_BASE}/login`);
  const registerLink = page.getByRole('link', { name: '登録申請' });
  await expect(registerLink).toBeVisible();
  await registerLink.click();
  await expect(page).toHaveURL(/\/register$/);
});

// ---------------------------------------------------------------------------
// Form validation (client-side)
// ---------------------------------------------------------------------------

test('/register: submitting with empty last name shows error', async ({ page }) => {
  await mockCompanies(page);
  await mockRegisterSuccess(page);
  await page.goto(`${LOCAL_BASE}/register`);

  // Fill everything except 姓
  await page.getByLabel('名 *').fill('太郎');
  await page.getByLabel('メールアドレス *').fill('test@example.com');
  const selectTrigger = page.getByRole('combobox');
  await expect(selectTrigger).toBeEnabled({ timeout: 10_000 });
  await selectTrigger.click();
  await page.getByRole('option').first().click();

  await page.getByRole('button', { name: '登録する' }).click();
  // Should NOT have navigated away or shown success
  await expect(page.getByText('招待メールを送信しました')).not.toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('/register: submitting with empty first name shows error', async ({ page }) => {
  await mockCompanies(page);
  await mockRegisterSuccess(page);
  await page.goto(`${LOCAL_BASE}/register`);

  await page.getByLabel('姓 *').fill('山田');
  await page.getByLabel('メールアドレス *').fill('test@example.com');
  const selectTrigger = page.getByRole('combobox');
  await expect(selectTrigger).toBeEnabled({ timeout: 10_000 });
  await selectTrigger.click();
  await page.getByRole('option').first().click();

  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByText('招待メールを送信しました')).not.toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test('/register: submitting without selecting company shows error', async ({ page }) => {
  await mockCompanies(page);
  await mockRegisterSuccess(page);
  await page.goto(`${LOCAL_BASE}/register`);

  await page.getByLabel('姓 *').fill('山田');
  await page.getByLabel('名 *').fill('太郎');
  await page.getByLabel('メールアドレス *').fill('test@example.com');
  // Do NOT select a company

  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByText('招待メールを送信しました')).not.toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

// ---------------------------------------------------------------------------
// Success flow
// ---------------------------------------------------------------------------

test('/register: valid submission shows success message', async ({ page }) => {
  await mockCompanies(page);
  await mockRegisterSuccess(page);
  await page.goto(`${LOCAL_BASE}/register`);

  await page.getByLabel('姓 *').fill('山田');
  await page.getByLabel('名 *').fill('太郎');
  await page.getByLabel('メールアドレス *').fill(`test-${Date.now()}@example.com`);

  const selectTrigger = page.getByRole('combobox');
  await expect(selectTrigger).toBeEnabled({ timeout: 10_000 });
  await selectTrigger.click();
  await page.getByRole('option', { name: 'テスト株式会社' }).click();

  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByText('招待メールを送信しました')).toBeVisible({ timeout: 15_000 });
});

test('/register: success screen has link back to /login', async ({ page }) => {
  await mockCompanies(page);
  await mockRegisterSuccess(page);
  await page.goto(`${LOCAL_BASE}/register`);

  await page.getByLabel('姓 *').fill('山田');
  await page.getByLabel('名 *').fill('太郎');
  await page.getByLabel('メールアドレス *').fill(`test-${Date.now()}@example.com`);

  const selectTrigger = page.getByRole('combobox');
  await expect(selectTrigger).toBeEnabled({ timeout: 10_000 });
  await selectTrigger.click();
  await page.getByRole('option').first().click();

  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByText('招待メールを送信しました')).toBeVisible({ timeout: 15_000 });

  const loginLink = page.getByRole('link', { name: 'ログイン画面に戻る' });
  await expect(loginLink).toBeVisible();
  await loginLink.click();
  await expect(page).toHaveURL(/\/login$/);
});

// ---------------------------------------------------------------------------
// Error handling (API error shown to user)
// ---------------------------------------------------------------------------

test('/register: duplicate email shows error message', async ({ page }) => {
  await mockCompanies(page);
  await mockRegisterError(page, 'このメールアドレスは既に登録されています', 409);
  await page.goto(`${LOCAL_BASE}/register`);

  await page.getByLabel('姓 *').fill('山田');
  await page.getByLabel('名 *').fill('太郎');
  await page.getByLabel('メールアドレス *').fill('existing@example.com');

  const selectTrigger = page.getByRole('combobox');
  await expect(selectTrigger).toBeEnabled({ timeout: 10_000 });
  await selectTrigger.click();
  await page.getByRole('option').first().click();

  await page.getByRole('button', { name: '登録する' }).click();
  await expect(page.getByText('このメールアドレスは既に登録されています')).toBeVisible({ timeout: 10_000 });
  // Should remain on register page, not show success
  await expect(page.getByText('招待メールを送信しました')).not.toBeVisible();
});
