import { expect, test } from "@playwright/test";
import { loginAdmin, seriousViolations, solidPng } from "./helpers";

interface AdminImage {
  id: string;
  url: string;
  isPrimary: boolean;
  source?: string;
}

/**
 * Quản lý ảnh ở trang sửa sản phẩm: ảnh quản trị viên tải lên phải hiện thật ở trang sản phẩm công khai (bản production
 * `next start` không có file mới trong public/ — web lấy từ API), còn tệp không phải ảnh bị chặn ở cả trình duyệt lẫn máy
 * chủ (máy chủ kiểm nội dung thật, không tin kiểu tệp trình duyệt khai). Tự tạo một sản phẩm riêng cho mỗi lượt chạy;
 * cuối test xoá ảnh (xoá cả file) và cho sản phẩm ngừng kinh doanh để các test khác không thấy nó.
 */
test("tải ảnh sản phẩm: ảnh hợp lệ hiện ở trang công khai, tệp không phải ảnh bị từ chối", async ({ page, browser }) => {
  test.setTimeout(120_000);
  await loginAdmin(page);

  const stamp = Date.now();
  const options = (await (await page.request.get("/api/admin/products/meta/options")).json()) as { categories: { id: string; name: string }[] };
  const category = options.categories.find((item) => item.name === "Chuột") ?? options.categories[0];
  const name = `Chuột kiểm thử ảnh ${stamp}`;
  const created = await page.request.post("/api/admin/products", {
    data: { name, sku: `E2E-IMG-${stamp}`, categoryId: category.id, sellingPrice: 990_000 },
  });
  expect(created.status(), await created.text()).toBe(201);
  const product = (await created.json()) as { id: string; slug: string };

  const front = { name: "mat-truoc.png", mimeType: "image/png", buffer: solidPng(320, 240, [194, 65, 12]) };
  const side = { name: "canh-ben.png", mimeType: "image/png", buffer: solidPng(240, 320, [37, 99, 235]) };

  try {
    await page.goto(`/admin/products/${product.id}`);
    const fileInput = page.locator("#product-image-files");
    const gallery = page.getByRole("list", { name: "Ảnh sản phẩm theo thứ tự hiển thị" });
    const pending = page.getByRole("list", { name: "Ảnh chờ tải lên" });
    await expect(page.getByText("Chưa có ảnh nào")).toBeVisible();

    // 1. Hai ảnh PNG thật: xem trước rồi tải lên một lượt, ảnh đầu tự thành ảnh chính
    await fileInput.setInputFiles([front, side]);
    await expect(pending.getByRole("listitem")).toHaveCount(2);
    await expect(pending.getByRole("img", { name: "Xem trước mat-truoc.png" })).toBeVisible();
    await page.getByRole("button", { name: "Tải lên 2 ảnh" }).click();
    await expect(page.getByText("Đã tải lên 2 ảnh")).toBeVisible();
    await expect(gallery.getByRole("listitem")).toHaveCount(2);
    await expect(gallery.getByRole("listitem").first()).toContainText("Ảnh chính");
    await expect(pending).toHaveCount(0);

    // 2. Tệp không phải ảnh: PDF bị trình duyệt chặn ngay theo loại tệp; HTML đội lốt PNG (khai image/png) qua được
    // trình duyệt nhưng máy chủ đọc chữ ký đầu tệp và từ chối cả lượt
    await fileInput.setInputFiles([
      { name: "bao-gia.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n%kiem-thu\n") },
      { name: "gia-mao.png", mimeType: "image/png", buffer: Buffer.from("<html><script>alert(1)</script></html>") },
    ]);
    await expect(page.getByRole("alert").filter({ hasText: "Có tệp không được nhận" })).toContainText(
      '"bao-gia.pdf" không phải ảnh JPEG, PNG hoặc WEBP',
    );
    await expect(pending.getByRole("listitem")).toHaveCount(1);

    // Khu quản lý ảnh đủ mọi trạng thái (ảnh đã lưu, ảnh chờ tải, thông báo lỗi) vẫn đạt WCAG 2.1 AA như các trang quản trị khác
    expect(await seriousViolations(page)).toEqual([]);

    await page.getByRole("button", { name: "Tải lên 1 ảnh" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Chưa tải ảnh lên được" })).toContainText(
      'Tệp "gia-mao.png" không phải ảnh JPEG/PNG/WEBP hợp lệ',
    );
    await page.getByRole("button", { name: "Bỏ chọn tất cả" }).click();
    await expect(pending).toHaveCount(0);
    await expect(gallery.getByRole("listitem")).toHaveCount(2);

    // 3. Đổi ảnh chính: ảnh mặt bên lên đầu
    await page.getByRole("button", { name: "Đặt ảnh 2 làm ảnh chính" }).click();
    await expect(page.getByText("Đã đặt làm ảnh chính")).toBeVisible();
    const detail = (await (await page.request.get(`/api/admin/products/${product.id}`)).json()) as { images: AdminImage[] };
    expect(detail.images.map((image) => [image.source, image.isPrimary])).toEqual([
      ["MANUAL", true],
      ["MANUAL", false],
    ]);
    const primary = detail.images[0];

    // Web phục vụ đúng nội dung ảnh vừa tải lên, dù file không có trong public/ lúc `next start` khởi động
    const served = await page.request.get(primary.url);
    expect(served.status()).toBe(200);
    expect(served.headers()["content-type"]).toBe("image/png");
    expect(Buffer.from(await served.body()).equals(side.buffer)).toBe(true);

    // 4. Mở bán → khách vãng lai thấy ảnh ở trang sản phẩm, ảnh chính đứng đầu
    const activated = await page.request.patch(`/api/admin/products/${product.id}/status`, { data: { status: "ACTIVE" } });
    expect(activated.ok(), await activated.text()).toBe(true);

    const shopperContext = await browser.newContext();
    try {
      const shopper = await shopperContext.newPage();
      await shopper.goto(`/san-pham/${product.slug}`);
      await expect(shopper.getByRole("heading", { level: 1, name })).toBeVisible();
      const mainImage = shopper.locator(`img[alt="${name}"]`).first();
      await expect(mainImage).toBeVisible();
      expect(await mainImage.getAttribute("src")).toContain(encodeURIComponent(primary.url));
      // Ảnh tải về và giải mã được thật (qua bộ tối ưu ảnh của Next), không phải khung ảnh vỡ
      await expect.poll(() => mainImage.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
      await expect(shopper.getByRole("button", { name: "Xem ảnh 2" })).toBeVisible();
    } finally {
      await shopperContext.close();
    }
  } finally {
    const current = (await (await page.request.get(`/api/admin/products/${product.id}`)).json()) as { images?: AdminImage[] };
    for (const image of current.images ?? []) {
      await page.request.delete(`/api/admin/products/${product.id}/images/${image.id}`);
    }
    await page.request.patch(`/api/admin/products/${product.id}/status`, { data: { status: "DISCONTINUED" } });
  }
});
