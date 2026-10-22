import { expect, test } from "@playwright/test";
import { loginAdmin, solidPng } from "./helpers";

interface AdminBanner {
  id: string;
  imageUrl: string;
  linkUrl?: string;
}

/**
 * Banner trang chủ: ảnh quản trị viên tải lên LÚC ĐANG CHẠY phải lấy được qua địa chỉ của web (bản production `next start`
 * không có file mới trong public/ — web chuyển tiếp sang API, không cần Caddy), cả ảnh gốc lẫn ảnh qua bộ tối ưu
 * `/_next/image`; liên kết khi bấm banner chỉ nhận đường dẫn trong trang bắt đầu bằng "/" hoặc http(s). Banner tạo ra
 * luôn để Nháp (trang chủ không đổi) và bị xoá ở cuối test.
 */
test("banner: ảnh tải lên lấy được qua web, liên kết lạ bị từ chối", async ({ page }) => {
  await loginAdmin(page);
  const createdIds: string[] = [];

  try {
    const png = solidPng(480, 160, [22, 163, 74]);
    const upload = await page.request.post("/api/admin/banners/upload-image", {
      multipart: { image: { name: "banner-e2e.png", mimeType: "image/png", buffer: png } },
    });
    expect(upload.status(), await upload.text()).toBe(201);
    const { url } = (await upload.json()) as { url: string };
    expect(url).toMatch(/^\/images\/banners\/[0-9a-f-]+\.png$/);

    const served = await page.request.get(url);
    expect(served.status(), "ảnh gốc lấy qua địa chỉ web").toBe(200);
    expect(served.headers()["content-type"]).toBe("image/png");
    expect(Buffer.compare(await served.body(), png), "đúng nội dung vừa tải lên").toBe(0);

    const optimized = await page.request.get(`/_next/image?url=${encodeURIComponent(url)}&w=640&q=75`);
    expect(optimized.status(), "bộ tối ưu ảnh của Next đọc được ảnh vừa tải lên").toBe(200);
    expect(optimized.headers()["content-type"]).toMatch(/^image\//);

    const createBanner = (linkUrl: string) =>
      page.request.post("/api/admin/banners", { data: { imageUrl: url, linkUrl, displayOrder: 99, status: "DRAFT" } });

    for (const linkUrl of ["/danh-muc/laptop", "https://example.com/khuyen-mai"]) {
      const response = await createBanner(linkUrl);
      expect(response.status(), `${linkUrl}: ${await response.text()}`).toBe(201);
      const banner = (await response.json()) as AdminBanner;
      createdIds.push(banner.id);
      expect(banner.linkUrl).toBe(linkUrl);
    }

    for (const linkUrl of ["javascript:alert(1)", "//evil.example", "/\\evil.example", "data:text/html,hi", "khuyen-mai"]) {
      const response = await createBanner(linkUrl);
      const body = (await response.json()) as { error?: string; details?: { field: string }[] };
      expect(response.status(), `${linkUrl} phải bị từ chối`).toBe(400);
      expect(body.error).toBe("VALIDATION_ERROR");
      expect(body.details?.map((detail) => detail.field)).toEqual(["linkUrl"]);
    }

    // Mã lỗi đúng loại (trước đây mọi lỗi nghiệp vụ đều ra "HttpError")
    const missing = await page.request.get("/api/admin/banners/khong-ton-tai");
    expect(missing.status()).toBe(404);
    expect(((await missing.json()) as { error: string }).error).toBe("NOT_FOUND");

    // Ảnh xem trước ở trang sửa banner (đi qua bộ tối ưu ảnh, không còn `unoptimized`) hiện được thật
    await page.goto(`/admin/banners/${createdIds[0]}`);
    const preview = page.getByRole("img", { name: "Xem trước banner" });
    await expect(preview).toBeVisible();
    await expect.poll(() => preview.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  } finally {
    for (const id of createdIds) {
      const removed = await page.request.delete(`/api/admin/banners/${id}`);
      expect(removed.status(), await removed.text()).toBe(204);
    }
  }
});
