import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'https://quiz-app-alpha-umber.vercel.app';
const useChrome = process.env.E2E_USE_CHROME === '1';
const browserName = (process.env.E2E_BROWSER ?? 'chromium') as 'chromium' | 'firefox' | 'webkit';
const headless = process.env.E2E_HEADFUL !== '1';
const disableLaunchArgs = process.env.E2E_DISABLE_LAUNCH_ARGS === '1';
const defaultLaunchArgs = process.platform === 'linux' ? ['--disable-gpu', '--no-sandbox'] : [];
const extraLaunchArgs = (process.env.E2E_LAUNCH_ARGS ?? '')
  .split(' ')
  .map((s) => s.trim())
  .filter(Boolean);

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  workers: 1,
  use: {
    baseURL,
    browserName,
    headless,
    ...(useChrome ? { channel: 'chrome' as const } : {}),
    launchOptions: {
      args: [
        ...(disableLaunchArgs ? [] : defaultLaunchArgs),
        ...extraLaunchArgs,
      ],
    },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  reporter: [['list']],
});
