import { defineConfig } from "@playwright/test";
import { API_PORT, API_URL, E2E_DATABASE_URL, WEB_PORT, WEB_URL } from "./e2e-env";

/**
 * Kiểm thử đầu-cuối PCZone: tự bật MỘT bộ API + web riêng trên DB kiểm thử (xem `e2e-env.ts`), chạy xong tự tắt.
 * Không gọi dịch vụ thật nào: AI (tốn quota Gemini), email Resend, VNPay, chuyển khoản/MoMo, Google/Facebook đều để
 * trống cấu hình — biến truyền ở đây được ưu tiên hơn `.env`.
 */
export default defineConfig({
  testDir: "./tests",
  // Chung một DB và một bộ server: chạy tuần tự cho kết quả ổn định, không test nào giẫm dữ liệu test khác
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalTeardown: "./global-teardown.ts",
  use: {
    baseURL: WEB_URL,
    // Dùng trình duyệt có sẵn trên máy (Edge đi kèm Windows) — không phải tải Chromium riêng của Playwright
    channel: process.env.E2E_BROWSER_CHANNEL ?? "msedge",
    locale: "vi-VN",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "setup", testMatch: /.*\.setup\.ts/ },
    { name: "e2e", testMatch: /.*\.spec\.ts/, dependencies: ["setup"] },
  ],
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
    {
      // Bản build production thật (next build + next start) — kiểm luôn cả khâu build
      command: `node ../e2e/scripts/wait-for.mjs ${API_URL}/health && npx next build && npx next start -p ${WEB_PORT} -H 127.0.0.1`,
      cwd: "../web",
      url: WEB_URL,
      timeout: 600_000,
      reuseExistingServer: false,
      stdout: "ignore",
      stderr: "pipe",
      env: { NEXT_PUBLIC_API_URL: "", API_URL, SITE_URL: WEB_URL },
    },
  ],
});
