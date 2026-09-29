import { expect, test } from "@playwright/test";
import { addToCart, MOUSE, PC_DRAGON, PC_ULTRA } from "./helpers";

test.describe("Cửa hàng — khách chưa đăng nhập", () => {
  test("trang chủ hiện sản phẩm nổi bật từ DB và hotline từ Cài đặt hệ thống", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Sản phẩm nổi bật" })).toBeVisible();
    await expect(page.locator(`a[href="/san-pham/${MOUSE.slug}"]`).first()).toBeVisible();
    await expect(page.getByRole("contentinfo").getByText("1800 8888").first()).toBeVisible();
  });

  test("tìm kiếm từ khoá (AI tắt vì không có khoá) vẫn ra đúng sản phẩm", async ({ page }) => {
    await page.goto("/tim-kiem?q=chuột logitech");
    await expect(page.locator(`a[href="/san-pham/${MOUSE.slug}"]`).first()).toBeVisible();
  });

  test("trang danh mục liệt kê sản phẩm của danh mục", async ({ page }) => {
    await page.goto("/danh-muc/chuot");
    await expect(page.getByRole("heading", { level: 1, name: "Chuột" })).toBeVisible();
    await expect(page.locator(`a[href="/san-pham/${MOUSE.slug}"]`).first()).toBeVisible();
  });

  test("thêm vào giỏ: giỏ hàng tính đúng tạm tính, miễn phí ship theo ngưỡng, bắt đăng nhập khi đặt hàng", async ({ page }) => {
    await addToCart(page, MOUSE.slug);
    await page.goto("/gio-hang");

    const summary = page.locator("aside").filter({ has: page.getByRole("heading", { name: "Tóm tắt đơn hàng" }) });
    await expect(summary.getByText("Tạm tính (1 sản phẩm)")).toBeVisible();
    await expect(summary).toContainText(MOUSE.price);
    // Mặc định miễn phí vận chuyển từ 500.000đ — chuột 3.490.000đ nên không mất phí
    await expect(summary.getByText("Miễn phí", { exact: true })).toBeVisible();
    await expect(summary.getByRole("link", { name: /Đăng nhập/ })).toBeVisible();
  });

  test("so sánh: nhãn thông số cùng nghĩa gộp về một dòng", async ({ page }) => {
    await page.addInitScript((slugs) => {
      window.localStorage.setItem("pczone.compareSlugs", JSON.stringify(slugs));
    }, [PC_ULTRA.slug, PC_DRAGON.slug]);
    await page.goto("/so-sanh");

    await expect(page.getByRole("table")).toBeVisible();
    await expect(page.getByRole("table")).toContainText("AMD Ryzen 7 7800X3D");
    await expect(page.getByRole("table")).toContainText("Intel Core i7-14700K");

    const labels = (await page.locator("tbody tr > td:first-child").allTextContents()).map((label) => label.trim());
    // Dữ liệu gốc ghi "CPU" / "Card đồ họa" / "RAM" / "Bảo hành" — phải hiện đúng một dòng dưới tên chuẩn
    for (const label of ["Bộ vi xử lý (CPU)", "Card đồ họa (VGA)", "Bộ nhớ RAM", "Bảo hành"]) {
      expect(labels.filter((item) => item === label), `nhãn "${label}"`).toHaveLength(1);
    }
    expect(labels).not.toContain("CPU");
    expect(labels).not.toContain("RAM");
  });
});
