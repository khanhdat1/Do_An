import { expect, test as setup } from "@playwright/test";
import { DEFAULT_SETTINGS, loginAdminViaApi } from "./helpers";

/**
 * Chạy trước mọi test (project "setup" trong playwright.config.ts). DB kiểm thử được giữ lại giữa các lượt chạy, nên
 * nếu lượt trước bị ngắt giữa chừng lúc đang đổi Cài đặt hệ thống thì phải trả về mặc định — làm qua đúng API quản trị
 * (có ghi nhật ký thao tác) chứ không sửa thẳng DB.
 */
setup("đưa Cài đặt hệ thống về mặc định", async ({ request }) => {
  await loginAdminViaApi(request);
  const response = await request.put("/api/admin/settings", { data: DEFAULT_SETTINGS });
  expect(response.ok(), await response.text()).toBe(true);
});
