import { expect, test } from "@playwright/test";
import { WEB_URL } from "../e2e-env";
import { loginAdminViaApi, MOUSE, placeCodOrderViaApi, registerCustomerViaApi } from "./helpers";

test.describe("Phân quyền", () => {
  test("chưa đăng nhập quản trị mà mở trang /admin/* thì bị đưa về trang đăng nhập quản trị", async ({ page }) => {
    await page.goto("/admin/orders");
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole("button", { name: "Đăng nhập", exact: true })).toBeVisible();
  });

  test("API quản trị từ chối khách vãng lai và cả phiên đăng nhập của khách hàng", async ({ request }) => {
    expect((await request.get("/api/admin/settings")).status()).toBe(401);

    await registerCustomerViaApi(request, "Khách Tò Mò");
    expect((await request.get("/api/account/summary")).status()).toBe(200);
    expect((await request.get("/api/admin/orders")).status()).toBe(401);
    expect((await request.put("/api/admin/settings", { data: {} })).status()).toBe(401);
  });

  test("khách không xem được đơn hàng của người khác", async ({ playwright }) => {
    const owner = await playwright.request.newContext({ baseURL: WEB_URL });
    const stranger = await playwright.request.newContext({ baseURL: WEB_URL });

    await registerCustomerViaApi(owner, "Chủ Đơn");
    const orderCode = await placeCodOrderViaApi(owner, MOUSE.slug);
    expect((await owner.get(`/api/orders/${orderCode}`)).status()).toBe(200);

    await registerCustomerViaApi(stranger, "Người Lạ");
    expect((await stranger.get(`/api/orders/${orderCode}`)).status()).toBe(404);

    await owner.dispose();
    await stranger.dispose();
  });

  test("tải ảnh banner: nội dung không phải ảnh bị từ chối dù tự khai là image/png", async ({ request }) => {
    await loginAdminViaApi(request);
    // Bị từ chối thì API tự xoá file vừa nhận — test không để lại gì trong thư mục banner
    const response = await request.post("/api/admin/banners/upload-image", {
      multipart: {
        image: { name: "banner.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") },
      },
    });
    expect(response.status()).toBe(400);
    expect(await response.text()).toContain("không phải ảnh");
  });
});
