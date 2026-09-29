import { AxeBuilder } from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { MOUSE } from "./helpers";

/** Trang công khai chính — khách vãng lai mở được, không cần dữ liệu riêng */
const PAGES = [
  "/",
  "/danh-muc/chuot",
  `/san-pham/${MOUSE.slug}`,
  "/gio-hang",
  "/dang-nhap",
  "/dang-ky",
  "/ai-build-pc",
  "/tim-kiem?q=chuot",
  "/tro-ly-ai",
  "/so-sanh",
  "/khuyen-mai",
  "/tra-cuu-don-hang",
];

const POLICY_PAGES = [
  "/chinh-sach-bao-mat",
  "/dieu-khoan-su-dung",
  "/chinh-sach-doi-tra-bao-hanh",
  "/chinh-sach-van-chuyen-thanh-toan",
];

/** Mở trang, chờ tải xong rồi chờ thêm tối đa 5 giây cho các yêu cầu nền lắng xuống (không chặn nếu vẫn còn) */
async function open(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle", { timeout: 5_000 }).catch(() => {});
}

/** Lỗi mức "serious"/"critical" theo WCAG 2.1 A + AA (axe-core) */
async function seriousViolations(page: Page, options: { skipContrast?: boolean } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  if (options.skipContrast) builder = builder.disableRules(["color-contrast"]);
  const { violations } = await builder.analyze();
  return violations
    .filter((violation) => violation.impact === "serious" || violation.impact === "critical")
    .map((violation) => ({
      rule: violation.id,
      count: violation.nodes.length,
      examples: violation.nodes.slice(0, 3).map((node) => node.target.join(" ")),
    }));
}

test.describe("Khả năng truy cập (WCAG 2.1 AA, axe-core)", () => {
  /**
   * Lỗi cấu trúc (thiếu nhãn ô nhập, ảnh thiếu chữ thay thế, ARIA sai, nút không có tên...) phải bằng 0. Độ tương phản
   * màu kiểm riêng ở test dưới: phần còn thiếu nằm ở màu thương hiệu (nút cam chữ trắng, chữ xám nhạt) — sửa triệt để là
   * đổi nhận diện màu sắc, đang chờ chủ dự án quyết định.
   */
  for (const path of PAGES) {
    test(`không có lỗi cấu trúc: ${path}`, async ({ page }) => {
      await open(page, path);
      expect(await seriousViolations(page, { skipContrast: true })).toEqual([]);
    });
  }

  test("độ tương phản màu: ghi nhận số lỗi còn lại ở trang chính (không chặn)", async ({ page }) => {
    const remaining: string[] = [];
    for (const path of PAGES) {
      await open(page, path);
      const contrast = (await seriousViolations(page)).find((item) => item.rule === "color-contrast");
      if (contrast) remaining.push(`${path}: ${contrast.count}`);
    }
    test.info().annotations.push({
      type: "độ tương phản còn thiếu",
      description: remaining.length > 0 ? remaining.join(" | ") : "không còn",
    });
  });

  // Trang chính sách viết mới theo đúng chuẩn — kiểm cả độ tương phản
  for (const path of POLICY_PAGES) {
    test(`đạt chuẩn đầy đủ kể cả độ tương phản: ${path}`, async ({ page }) => {
      await open(page, path);
      expect(await seriousViolations(page)).toEqual([]);
    });
  }
});

test.describe("Giao diện điện thoại (375px)", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const path of [...PAGES, "/chinh-sach-bao-mat"]) {
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
