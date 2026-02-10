import { expect, test } from '@playwright/test';

test('admin invite route exists on server function', async ({ request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  expect(supabaseUrl, 'VITE_SUPABASE_URL is required').toBeTruthy();

  const endpoint = `${supabaseUrl}/functions/v1/server/admin/invite`;
  const res = await request.fetch(endpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: 'http://127.0.0.1:5173',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });

  expect(res.status(), `preflight failed for ${endpoint}`).not.toBe(404);
});
