import { expect, test } from '@playwright/test';

test('admin users endpoint accepts admin bearer token', async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  expect(supabaseUrl, 'VITE_SUPABASE_URL is required').toBeTruthy();
  expect(anonKey, 'VITE_SUPABASE_ANON_KEY is required').toBeTruthy();
  expect(email, 'E2E_ADMIN_EMAIL is required').toBeTruthy();
  expect(password, 'E2E_ADMIN_PASSWORD is required').toBeTruthy();

  const authRes = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: {
      apikey: anonKey as string,
      'Content-Type': 'application/json',
    },
    data: { email, password },
  });
  expect(authRes.ok(), `auth failed: ${authRes.status()} ${await authRes.text()}`).toBeTruthy();
  const authJson = await authRes.json();
  const accessToken = authJson.access_token as string | undefined;
  expect(accessToken, 'access_token is missing').toBeTruthy();

  const adminRes = await request.get(`${supabaseUrl}/functions/v1/server/admin/users`, {
    headers: {
      apikey: anonKey as string,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  expect(adminRes.status(), `admin/users failed: ${await adminRes.text()}`).toBe(200);
});
