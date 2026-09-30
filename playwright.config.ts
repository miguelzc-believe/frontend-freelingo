import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:3102', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'pnpm exec tsx scripts/mock-backend.ts',
      port: 3199,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm build && pnpm start',
      port: 3102,
      env: {
        BACKEND_URL: 'http://127.0.0.1:3199',
        PORT: '3102',
        HOST: '127.0.0.1',
      },
      timeout: 120000,
      reuseExistingServer: false,
    },
  ],
})
