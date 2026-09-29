import { expect, test } from "@playwright/test";
import { WEB_URL } from "../e2e-env";
import { MOUSE } from "./helpers";

test.describe("SEO và header bảo mật", () => {
  test("robots.txt chặn khu quản trị/trang riêng và trỏ tới sitemap", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    for (const path of ["/admin", "/api/", "/tai-khoan", "/thanh-toan", "/don-hang"]) {
      expect(body).toContain(`Disallow: ${path}`);
    }
    expect(body).toContain(`Sitemap: ${WEB_URL}/sitemap.xml`);
  });

  test("sitemap.xml liệt kê sản phẩm, danh mục và trang chính sách bằng địa chỉ tuyệt đối", async ({ request }) => {
    const response = await request.get("/sitemap.xml");
    expect(response.ok()).toBe(true);
    const body = await response.text();
    expect(body).toContain(`<loc>${WEB_URL}/san-pham/${MOUSE.slug}</loc>`);
    expect(body).toContain(`<loc>${WEB_URL}/danh-muc/chuot</loc>`);
    expect(body).toContain(`<loc>${WEB_URL}/chinh-sach-bao-mat</loc>`);
    expect(body).not.toContain("/admin");
  });

  test("trang có header chống clickjacking/đoán kiểu nội dung và không lộ X-Powered-By", async ({ request }) => {
    const response = await request.get("/");
    const headers = response.headers();
    expect(headers["x-frame-options"]).toBe("DENY");
    expect(headers["x-content-type-options"]).toBe("nosniff");
    expect(headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(headers["x-powered-by"]).toBeUndefined();
  });

  // DB kiểm thử nạp seed không tải ảnh nên ở đây không có og:image — phần ảnh đã kiểm trên DB có ảnh thật
  test("trang sản phẩm có thẻ chia sẻ mạng xã hội (Open Graph)", async ({ page }) => {
    await page.goto(`/san-pham/${MOUSE.slug}`);
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", MOUSE.name);
    await expect(page.locator('meta[property="og:site_name"]')).toHaveAttribute("content", "PCZone");
    await expect(page.locator('meta[property="og:locale"]')).toHaveAttribute("content", "vi_VN");
  });
});
