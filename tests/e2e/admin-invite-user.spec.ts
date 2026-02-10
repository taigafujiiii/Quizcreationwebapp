import { expect, test } from '@playwright/test';

test('admin can invite a user via server function', async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;

  expect(supabaseUrl, 'VITE_SUPABASE_URL is required').toBeTruthy();
  expect(anonKey, 'VITE_SUPABASE_ANON_KEY is required').toBeTruthy();
  expect(email, 'E2E_ADMIN_EMAIL is required').toBeTruthy();
  expect(password, 'E2E_ADMIN_PASSWORD is required').toBeTruthy();

  // Get an admin access token via password grant.
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

  // Use a unique email to avoid collisions. We only assert API success, not delivery.
  const domain = (email as string).split('@')[1] || 'localhost';
  const inviteEmail = `e2e-invite-${Date.now()}@${domain}`;
  const inviteRes = await request.post(`${supabaseUrl}/functions/v1/server/admin/invite`, {
    headers: {
      apikey: anonKey as string,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    data: {
      email: inviteEmail,
      role: 'user',
      allowedUnitIds: [],
    },
  });

  expect(inviteRes.status(), `invite failed: ${await inviteRes.text()}`).toBe(200);
  await expect(inviteRes.json()).resolves.toMatchObject({ success: true });
});
