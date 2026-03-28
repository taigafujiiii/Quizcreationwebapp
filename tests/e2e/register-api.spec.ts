/**
 * Self-registration API tests
 *
 * Tests the public Supabase Edge Function endpoints directly:
 *   GET  /public/companies         — company list (no auth required)
 *   POST /public/register-request  — self-registration (sends invite immediately)
 *
 * These tests require network access to the Supabase project.
 * They are skipped automatically when the endpoint is unreachable.
 *
 * A real invite is sent for the "valid data" test.
 */
import { expect, test } from '@playwright/test';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? '';
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const FN_BASE = `${SUPABASE_URL}/functions/v1/server`;

const publicHeaders = () => ({
  apikey: ANON_KEY,
  'Content-Type': 'application/json',
});

/** Returns true if the Supabase health endpoint is reachable. */
const isSupabaseReachable = async (request: any): Promise<boolean> => {
  try {
    const res = await request.get(`${FN_BASE}/health`, {
      headers: publicHeaders(),
      timeout: 8_000,
    });
    return res.status() === 200;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// GET /public/companies
// ---------------------------------------------------------------------------

test('GET /public/companies returns 200 without auth', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.get(`${FN_BASE}/public/companies`, {
    headers: publicHeaders(),
  });
  expect(res.status(), await res.text()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /public/companies items have id and name', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.get(`${FN_BASE}/public/companies`, {
    headers: publicHeaders(),
  });
  expect(res.status()).toBe(200);
  const companies: unknown[] = await res.json();
  if (companies.length > 0) {
    const first = companies[0] as Record<string, unknown>;
    expect(typeof first.id).toBe('string');
    expect(typeof first.name).toBe('string');
  }
});

// ---------------------------------------------------------------------------
// POST /public/register-request — validation errors (no invite sent)
// ---------------------------------------------------------------------------

test('POST /public/register-request: missing email returns 400', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: { lastName: '山田', firstName: '太郎', companyId: '00000000-0000-4000-8000-000000000001' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test('POST /public/register-request: missing lastName returns 400', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: { email: 'test@example.com', firstName: '太郎', companyId: '00000000-0000-4000-8000-000000000001' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test('POST /public/register-request: missing firstName returns 400', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: { email: 'test@example.com', lastName: '山田', companyId: '00000000-0000-4000-8000-000000000001' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test('POST /public/register-request: missing companyId returns 400', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: { email: 'test@example.com', lastName: '山田', firstName: '太郎' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test('POST /public/register-request: invalid email format returns 400', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: { email: 'not-an-email', lastName: '山田', firstName: '太郎', companyId: '00000000-0000-4000-8000-000000000001' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

test('POST /public/register-request: non-existent companyId returns 400', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: {
      email: `dummy-${Date.now()}@example.com`,
      lastName: '山田',
      firstName: '太郎',
      companyId: '00000000-0000-4000-8000-000000000099',
    },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});

// ---------------------------------------------------------------------------
// POST /public/register-request — success (real invite sent)
// ---------------------------------------------------------------------------

test('POST /public/register-request: valid data sends invite and returns 200', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const companiesRes = await request.get(`${FN_BASE}/public/companies`, {
    headers: publicHeaders(),
  });
  expect(companiesRes.status()).toBe(200);
  const companies: Array<{ id: string; name: string }> = await companiesRes.json();
  expect(companies.length, 'テスト用の会社が1つ以上必要です').toBeGreaterThan(0);

  const companyId = companies[0].id;
  const email = `e2e-register-${Date.now()}@example.com`;

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: { email, lastName: 'テスト', firstName: '登録', companyId },
  });
  expect(res.status(), `register failed: ${await res.text()}`).toBe(200);
  const body = await res.json();
  expect(body).toMatchObject({ success: true });
});

// ---------------------------------------------------------------------------
// POST /public/register-request — duplicate email
// ---------------------------------------------------------------------------

test('POST /public/register-request: already-registered active email returns 409', async ({ request }) => {
  if (!await isSupabaseReachable(request)) {
    test.skip(true, 'Supabase endpoint not reachable from this environment');
    return;
  }

  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  if (!adminEmail) {
    test.skip(true, 'E2E_ADMIN_EMAIL not set');
    return;
  }

  const companiesRes = await request.get(`${FN_BASE}/public/companies`, {
    headers: publicHeaders(),
  });
  const companies: Array<{ id: string }> = await companiesRes.json();
  if (companies.length === 0) {
    test.skip(true, '会社がないためスキップ');
    return;
  }

  const res = await request.post(`${FN_BASE}/public/register-request`, {
    headers: publicHeaders(),
    data: { email: adminEmail, lastName: '山田', firstName: '太郎', companyId: companies[0].id },
  });
  expect(res.status()).toBe(409);
  const body = await res.json();
  expect(body.error).toBeTruthy();
});
