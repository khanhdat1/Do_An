import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { loginAdminViaApi, MOUSE, placeCodOrderViaApi, registerCustomerViaApi } from "./helpers";

/** Trang khách vãng lai mở được, không cần dữ liệu riêng */
const GUEST_PAGES = [
  "/",
  "/danh-muc",
  "/danh-muc/chuot",
  `/san-pham/${MOUSE.slug}`,
  "/gio-hang",
  "/dang-nhap",
  "/dang-ky",
  "/quen-mat-khau",
  "/ai-build-pc",
  "/tim-kiem?q=chuot",
  "/tro-ly-ai",
  "/so-sanh",
  "/khuyen-mai",
  "/tra-cuu-don-hang",
  "/chinh-sach-bao-mat",
  "/dieu-khoan-su-dung",
  "/chinh-sach-doi-tra-bao-hanh",
  "/chinh-sach-van-chuyen-thanh-toan",
  "/admin/login",
];

/** Trang của khách đã đăng nhập (thêm trang chi tiết đơn vừa đặt trong test) */
const CUSTOMER_PAGES = ["/tai-khoan", "/tai-khoan/don-hang", "/tai-khoan/cau-hinh", "/yeu-thich", "/gio-hang", "/thanh-toan"];

/** Khu quản trị (thêm trang chi tiết một đơn trong test) */
const ADMIN_PAGES = [
  "/admin",
  "/admin/orders",
  "/admin/products",
  "/admin/products/new",
  "/admin/customers",
  "/admin/vouchers",
  "/admin/vouchers/new",
  "/admin/banners",
  "/admin/banners/new",
  "/admin/reviews",
  "/admin/settings",
  "/admin/accounts",
  "/admin/accounts/new",
  "/admin/2fa",
];

/** Mở trang, chờ tải xong rồi chờ thêm tối đa 5 giây cho các yêu cầu nền lắng xuống (không chặn nếu vẫn còn) */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

/** Lỗi mức "serious"/"critical" theo WCAG 2.1 A + AA (axe-core), kể cả độ tương phản màu */
async function seriousViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      count: violation.nodes.length,
      examples: violation.nodes.slice(0, 3).map((node) => `${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1]?.trim() ?? ""}`),
    }));
}

/** Quét lần lượt nhiều trang trong cùng một phiên, gom lỗi theo trang để báo một lần */
async function scanAll(page: Page, paths: string[]) {
  const failures: { path: string; violations: Awaited<ReturnType<typeof seriousViolations>> }[] = [];
  for (const path of paths) {
    await open(page, path);
    const found = await seriousViolations(page);
    if (found.length > 0) failures.push({ path, violations: found });
  }
  return failures;
}

test.describe("Khả năng truy cập (WCAG 2.1 AA, axe-core, gồm cả độ tương phản màu)", () => {
  for (const path of GUEST_PAGES) {
    test(`khách vãng lai: ${path}`, async ({ page }) => {
      await open(page, path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }

  test("khách đã đăng nhập: tài khoản, đơn hàng, yêu thích, giỏ hàng, thanh toán, chi tiết đơn", async ({ page }) => {
    test.setTimeout(180_000);
    await registerCustomerViaApi(page.request, "Khách Kiểm Tra Truy Cập");
    const orderCode = await placeCodOrderViaApi(page.request, MOUSE.slug);
    // Đặt đơn xong giỏ trống — thêm lại một món để trang giỏ hàng/thanh toán có nội dung thật
    const product = (await (await page.request.get(`/api/products/${MOUSE.slug}`)).json()) as { id: string };
    expect((await page.request.post("/api/cart/items", { data: { productId: product.id, quantity: 1 } })).ok()).toBe(true);

    expect(await scanAll(page, [...CUSTOMER_PAGES, `/don-hang/${encodeURIComponent(orderCode)}`])).toEqual([]);
  });

  test("khu quản trị: mọi trang danh sách, biểu mẫu, cài đặt, trang chi tiết/sửa và phiếu in đơn", async ({ page, playwright }) => {
    test.setTimeout(300_000);
    // Tự tạo một đơn (khách riêng) để luôn có trang chi tiết đơn và hồ sơ khách để quét, kể cả trên DB kiểm thử mới tinh
    const shopper = await playwright.request.newContext({ baseURL: test.info().project.use.baseURL });
    await registerCustomerViaApi(shopper, "Khách Tạo Đơn Mẫu");
    const orderCode = await placeCodOrderViaApi(shopper, MOUSE.slug);
    await shopper.dispose();

    await loginAdminViaApi(page.request);
    // Trang sửa/chi tiết: lấy bản ghi đầu tiên của từng danh sách (seed luôn có sản phẩm và mã giảm giá)
    const detailPages: string[] = [];
    for (const [api, web] of [
      ["/api/admin/products", "/admin/products"],
      ["/api/admin/customers", "/admin/customers"],
      ["/api/admin/vouchers", "/admin/vouchers"],
      ["/api/admin/banners", "/admin/banners"],
      ["/api/admin/accounts", "/admin/accounts"],
    ]) {
      const body = (await (await page.request.get(api)).json()) as { items?: { id: string }[] } | { id: string }[];
      const first = (Array.isArray(body) ? body : (body.items ?? []))[0];
      if (first) detailPages.push(`${web}/${first.id}`);
    }
    expect(detailPages.length).toBeGreaterThanOrEqual(3);

    const order = `/admin/orders/${encodeURIComponent(orderCode)}`;
    expect(await scanAll(page, [...ADMIN_PAGES, ...detailPages, order, `${order}/print`])).toEqual([]);
  });
});

test.describe("Giao diện điện thoại (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of GUEST_PAGES.filter((path) => !path.startsWith("/admin"))) {
    test(`không tràn ngang: ${path}`, async ({ page }) => {
      await open(page, path);
      const { scrollWidth, innerWidth } = await page.evaluate(() => ({
        scrollWidth: document.documentElement.scrollWidth,
        innerWidth: window.innerWidth,
      }));
      expect(scrollWidth).toBeLessThanOrEqual(innerWidth);
    });
  }
});
