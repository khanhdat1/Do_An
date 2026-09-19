/**
 * Kiểm thử logic nhận diện URL và trích ảnh của từng adapter.
 * Chạy: npx tsx src/images/adapters.test.ts
 *
 * Các URL dưới đây là định dạng thật, đã xác minh trực tiếp trên trang của hãng.
 */
import { asrockAdapter, gigabyteAdapter } from "./adapters.js";
import { matchProduct, type CatalogEntry } from "./normalize.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}\n      mong đợi: ${e}\n      nhận được: ${a}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
console.log("\n── Gigabyte: trích ảnh từ HTML ─────────────────────────");
{
  // Trang thật đặt ảnh sản phẩm ở og:image trên static.gigabyte.com,
  // còn /FileUpload/ là ảnh minh hoạ tính năng — phải loại.
  const html = `
    <html><head>
      <meta property="og:image"
            content="https://static.gigabyte.com/StaticFile/Image/Global/abc/ProductRemoveBg/33879">
    </head><body>
      <img src="https://static.gigabyte.com/StaticFile/Image/Global/def/ProductRemoveBg/33880">
      <img src="https://www.gigabyte.com/FileUpload/Global/KeyFeature/2159/innergigabyteimages/feature-1.png">
      <img src="https://static.gigabyte.com/Images/logo.png">
    </body></html>`;

  const images = gigabyteAdapter.extractImages(
    html,
    "https://www.gigabyte.com/Motherboard/B760M-GAMING-X-AX",
    "B760M GAMING X AX"
  );

  check("Lấy 2 ảnh sản phẩm, loại FileUpload và logo", images.length, 2);
  check(
    "og:image đứng đầu",
    images[0].url,
    "https://static.gigabyte.com/StaticFile/Image/Global/abc/ProductRemoveBg/33879"
  );
  check("alt ghi rõ nguồn", images[0].alt, "B760M GAMING X AX - Official GIGABYTE");
}

// ---------------------------------------------------------------------------
console.log("\n── ASRock: trích ảnh và sắp thứ tự ─────────────────────");
{
  // Trang thật có (M1) là ảnh chính và (S1)...(S6) là ảnh phụ.
  // Code cũ chỉ đoán được (M1), bỏ mất 6 ảnh.
  const html = `
    <html><head>
      <meta property="og:image"
            content="https://www.asrock.com/mb/photo/B760M%20Pro%20RS(M1).png">
    </head><body>
      <img src="/mb/photo/B760M%20Pro%20RS(S3).png">
      <img src="/mb/photo/B760M%20Pro%20RS(S1).png">
      <img src="/mb/photo/B760M%20Pro%20RS(S2).png">
      <img src="/common/logo.png">
    </body></html>`;

  const images = asrockAdapter.extractImages(
    html,
    "https://www.asrock.com/mb/Intel/B760M%20Pro%20RS/index.asp",
    "B760M Pro RS"
  );

  check("Lấy đủ 4 ảnh (M1 + S1..S3), loại logo", images.length, 4);
  check("Ảnh chính (M1) xếp đầu", /\(M1\)/.test(decodeURIComponent(images[0].url)), true);
  check(
    "Ảnh phụ sắp đúng S1 -> S2 -> S3",
    images.slice(1).map((i) => decodeURIComponent(i.url).match(/\(S(\d)\)/)?.[1]),
    ["1", "2", "3"]
  );
}

// ---------------------------------------------------------------------------
console.log("\n── Nối danh mục với so khớp (luồng thật) ───────────────");
{
  // Mô phỏng danh mục dựng từ sitemap Gigabyte: model suy ra từ slug URL
  const fromSitemap = [
    "https://www.gigabyte.com/Motherboard/B760M-GAMING-X",
    "https://www.gigabyte.com/Motherboard/B760M-GAMING-X-AX",
    "https://www.gigabyte.com/Motherboard/B760M-DS3H-rev-10",
    "https://www.gigabyte.com/Graphics-Card/GV-N4060EAGLE-OC-8GD",
  ];

  const catalog: CatalogEntry[] = fromSitemap.map((url) => ({
    model: url.split("/").pop()!.replace(/-rev-[0-9]+$/i, "").replace(/-/g, " "),
    url,
  }));

  check("Hậu tố -rev-10 bị cắt khỏi tên model", catalog[2].model, "B760M DS3H");

  const out = matchProduct("Mainboard Gigabyte B760M DS3H (rev. 1.0)", catalog);
  check(
    "Tên shop có (rev. 1.0) vẫn khớp đúng",
    out.status === "MATCHED" ? out.result.entry.url : out.status,
    "https://www.gigabyte.com/Motherboard/B760M-DS3H-rev-10"
  );

  const out2 = matchProduct("Mainboard Gigabyte B760M GAMING X", catalog);
  check(
    "Không ăn nhầm bản AX",
    out2.status === "MATCHED" ? out2.result.entry.model : out2.status,
    "B760M GAMING X"
  );
}

console.log(`\n═══ Kết quả: ${passed} đạt, ${failed} trượt ═══\n`);
process.exit(failed > 0 ? 1 : 0);