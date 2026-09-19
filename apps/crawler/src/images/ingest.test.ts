/**
 * Kiểm thử tầng ingest. Chạy: npx tsx src/images/ingest.test.ts
 *
 * Dựng một server ảnh cục bộ rồi chạy đúng pipeline thật qua nó — tải về,
 * kiểm tra chất lượng, chuyển WebP, ghi đĩa — thay vì gọi ra internet.
 */
process.env.IMAGE_STORAGE_DIR = ".tmp-ingest-test";
process.env.IMAGE_PUBLIC_BASE = "/images/products";

import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { ingestImage } from "./ingest.js";

const STORAGE = ".tmp-ingest-test";

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

/** Ảnh đặc, nhiều chi tiết để WebP không nén xuống dưới ngưỡng tối thiểu. */
async function makeImage(width: number, height: number): Promise<Buffer> {
  const noise = Buffer.alloc(width * height * 3);
  for (let i = 0; i < noise.length; i++) noise[i] = (i * 7919) % 256;
  return sharp(noise, { raw: { width, height, channels: 3 } }).png().toBuffer();
}

async function main() {
  const assets: Record<string, { body: Buffer; type: string }> = {
    // ảnh sản phẩm bình thường
    "/product.png": { body: await makeImage(1000, 1000), type: "image/png" },
    // URL không có phần mở rộng — đúng dạng og:image của Gigabyte
    "/ProductRemoveBg/33879": { body: await makeImage(1200, 900), type: "image/png" },
    // bản sao y hệt product.png, khác URL
    "/same-again.png": { body: await makeImage(1000, 1000), type: "image/png" },
    // icon nhỏ
    "/icon.png": { body: await makeImage(64, 64), type: "image/png" },
    // biểu ngữ dài
    "/banner.png": { body: await makeImage(2400, 500), type: "image/png" },
    // không phải ảnh
    "/notimage.txt": { body: Buffer.from("x".repeat(20000)), type: "text/plain" },
  };

  const server = http.createServer((req, res) => {
    const asset = assets[req.url ?? ""];
    if (!asset) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { "Content-Type": asset.type }).end(asset.body);
  });

  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const SKU = "PCZ-MB-ASROCK-583A16";
  const seen = new Set<string>();

  console.log("\n── Ảnh sản phẩm hợp lệ ─────────────────────────────────");
  {
    const out = await ingestImage(SKU, `${base}/product.png`, seen);
    check("Nhận ảnh 1000x1000", out.status, "OK");

    if (out.status === "OK") {
      check("URL công khai là đường dẫn nội bộ, không trỏ ra ngoài",
        out.image.url.startsWith("/images/products/"), true);
      check("URL chứa SKU", out.image.url.includes(SKU), true);
      check("Đuôi .webp", out.image.url.endsWith("-medium.webp"), true);
      check("Bản medium rộng 800", out.image.width, 800);
      check("Giữ lại URL gốc để tải lại", out.image.remoteUrl, `${base}/product.png`);
      check("Checksum dài 64 ký tự (SHA-256)", out.image.checksum.length, 64);

      // ba cỡ phải cùng nằm trong thư mục của SKU
      const files = (await fs.readdir(path.join(STORAGE, SKU))).sort();
      check("Sinh đủ 3 cỡ", files.length, 3);
      check("Tên file đúng quy ước",
        files.map((f) => f.replace(/^[0-9a-f]+-/, "")),
        ["large.webp", "medium.webp", "thumb.webp"]);
    }
  }

  console.log("\n── URL không có phần mở rộng (og:image Gigabyte) ───────");
  {
    const out = await ingestImage(SKU, `${base}/ProductRemoveBg/33879`, seen);
    check("Nhận dạng qua nội dung file, không qua đuôi URL", out.status, "OK");
  }

  console.log("\n── Ảnh trùng nội dung, khác URL ────────────────────────");
  {
    // Cùng xuất hiện ở og:image lẫn thẻ <img> — rất hay gặp
    const out = await ingestImage(SKU, `${base}/same-again.png`, seen);
    check("Phát hiện trùng theo checksum, không lưu lần hai", out.status, "DUPLICATE");
  }

  console.log("\n── Loại ảnh không phải ảnh sản phẩm ────────────────────");
  {
    const icon = await ingestImage(SKU, `${base}/icon.png`, seen);
    check("Loại icon 64x64", icon.status, "REJECTED");

    const banner = await ingestImage(SKU, `${base}/banner.png`, seen);
    check("Loại biểu ngữ 2400x500 (đủ cao, nhưng tỷ lệ 4.8)", banner.status, "REJECTED");
    if (banner.status === "REJECTED") {
      check("Nêu đúng lý do", /tỷ lệ bất thường/.test(banner.reason), true);
    }

    const notImage = await ingestImage(SKU, `${base}/notimage.txt`, seen);
    check("Loại file không phải ảnh", notImage.status, "REJECTED");
  }

  console.log("\n── URL hỏng ────────────────────────────────────────────");
  {
    const out = await ingestImage(SKU, `${base}/khong-ton-tai.png`, seen);
    check("Báo lỗi thay vì ném exception", out.status, "ERROR");
  }

  server.close();
  await fs.rm(STORAGE, { recursive: true, force: true });

  console.log(`\n═══ Kết quả: ${passed} đạt, ${failed} trượt ═══\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});