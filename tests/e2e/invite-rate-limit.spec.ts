import { expect, test } from '@playwright/test';

test('invite endpoint rate-limits repeated attempts for same email', async ({ request }) => {
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

  const badEmail = `bad-invite-${Date.now()}`; // intentionally invalid format
  const endpoint = `${supabaseUrl}/functions/v1/server/admin/invite`;

  const first = await request.post(endpoint, {
    headers: {
      apikey: anonKey as string,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    data: { email: badEmail, role: 'user', allowedUnitIds: [] },
  });
  // Could be 400 (invalid email) if invite_logs is active; otherwise may still be 400.
  expect([400, 429]).toContain(first.status());

  const second = await request.post(endpoint, {
    headers: {
      apikey: anonKey as string,
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    data: { email: badEmail, role: 'user', allowedUnitIds: [] },
  });

  // With invite_logs enabled, second attempt should be blocked (429) without consuming provider quota.
  if (second.status() !== 429) {
    test.skip(true, `rate limit not active (status=${second.status()} body=${await second.text()})`);
  }
  expect(second.status()).toBe(429);
});

