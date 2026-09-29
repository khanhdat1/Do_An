import { expect, test } from "@playwright/test";
import { addToCart, loginAdmin, MOUSE } from "./helpers";

/**
 * Cài đặt hệ thống: số chủ website lưu ở /admin/settings phải được áp dụng thật ở phía khách, và máy chủ phải chặn
 * cấu hình khiến khách không đặt hàng được. Cuối test luôn trả cài đặt về như cũ để các test khác (cùng DB) không bị
 * ảnh hưởng.
 *
 * Không kiểm hotline ở đầu/chân trang: phần đó dựng ở server với bộ nhớ đệm 60 giây — trang Cài đặt đã ghi rõ "cập
 * nhật trong khoảng 1 phút" — nên phải chờ cả phút, và bản đệm dùng chung còn làm lệch kết quả các test chạy sau.
 * Phí vận chuyển ở giỏ hàng thì trang tự hỏi lại API mỗi lần mở nên đúng ngay.
 */
test("đổi phí vận chuyển → giỏ hàng của khách áp dụng ngay; không cho tắt phương thức thanh toán cuối cùng", async ({
  page,
  browser,
}) => {
  await loginAdmin(page);
  const original = await page.request.get("/api/admin/settings");
  expect(original.ok()).toBe(true);
  const originalSettings = ((await original.json()) as { settings: unknown }).settings;

  try {
    await page.goto("/admin/settings");
    await page.locator("#settings-fee").fill("45000");
    await page.locator("#settings-threshold").fill("10000000");
    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(page.getByText("Đã lưu cài đặt hệ thống")).toBeVisible();

    const shopperContext = await browser.newContext();
    const shopper = await shopperContext.newPage();
    await addToCart(shopper, MOUSE.slug);
    await shopper.goto("/gio-hang");
    const summary = shopper.locator("aside").filter({ has: shopper.getByRole("heading", { name: "Tóm tắt đơn hàng" }) });
    // Chuột 3.490.000đ dưới ngưỡng mới 10.000.000đ → mất phí 45.000đ, tổng 3.535.000đ
    await expect(summary.getByText("45.000đ", { exact: true })).toBeVisible();
    await expect(summary.getByText("Miễn phí vận chuyển cho đơn từ 10.000.000đ")).toBeVisible();
    await expect(summary).toContainText("3.535.000đ");
    await shopperContext.close();

    // Máy kiểm thử không cấu hình VNPay/chuyển khoản/MoMo → COD là phương thức duy nhất khách dùng được
    await page.locator("#settings-payment-cod").uncheck();
    await page.getByRole("button", { name: "Lưu cài đặt" }).click();
    await expect(page.getByText("Phải bật ít nhất một phương thức thanh toán đã được cấu hình").first()).toBeVisible();
    const after = await page.request.get("/api/settings");
    expect(((await after.json()) as { payments: { cod: boolean } }).payments.cod).toBe(true);
  } finally {
    const restored = await page.request.put("/api/admin/settings", { data: originalSettings });
    expect(restored.ok(), await restored.text()).toBe(true);
  }
});
