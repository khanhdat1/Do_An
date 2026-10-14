import { defineConfig } from "@playwright/test";
import { API_PORT, API_URL, E2E_DATABASE_URL, WEB_URL } from "./e2e-env";

/**
 * Bản rút gọn của `playwright.config.ts` cho các ca kiểm thử chỉ gọi API (TC16–TC20, `order-edge-cases.spec.ts`):
 * chỉ bật API trên DB kiểm thử `pczone_e2e` (có bước chuẩn bị DB y như cấu hình chính), KHÔNG build/bật web — chạy
 * nhanh trên máy yếu. Request gửi thẳng tới API kèm header Origin của web kiểm thử, đúng như trình duyệt gửi qua proxy.
 *
 *   npx playwright test -c playwright.api-only.config.ts
 */
export default defineConfig({
  testDir: "./tests",
  testMatch: /order-edge-cases\.spec\.ts/,
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  use: {
    baseURL: API_URL,
    extraHTTPHeaders: { Origin: WEB_URL },
  },
  webServer: [
    {
      command: "node ../e2e/scripts/prepare-db.mjs && npx tsx src/server.ts",
      cwd: "../api",
      url: `${API_URL}/health`,
      timeout: 240_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
      env: {
        DATABASE_URL: E2E_DATABASE_URL,
        E2E_DATABASE_URL,
        API_PORT: String(API_PORT),
        WEB_URL,
        CORS_ORIGIN: WEB_URL,
        API_PUBLIC_URL: API_URL,
        OPENAI_API_KEY: "",
        RESEND_API_KEY: "",
        VNPAY_TMN_CODE: "",
        VNPAY_HASH_SECRET: "",
        BANK_ID: "",
        BANK_ACCOUNT_NUMBER: "",
        BANK_ACCOUNT_NAME: "",
        BANK_NAME: "",
        MOMO_PHONE: "",
        MOMO_DISPLAY_NAME: "",
        GOOGLE_CLIENT_ID: "",
        GOOGLE_CLIENT_SECRET: "",
        FACEBOOK_APP_ID: "",
        FACEBOOK_APP_SECRET: "",
      },
    },
  ],
});
