/**
 * Kiểm tra danh sách ảnh (seed-manifest.ts) mà không cần mạng hay DB.
 * Chạy: npx tsx src/images/seed-manifest.test.ts
 *
 * Bắt các lỗi hay gặp khi sửa danh sách: gõ sai slug, quên một sản phẩm, dán trùng
 * URL, và — quan trọng với yêu cầu "chỉ dùng ảnh thật" — chặn URL trỏ tới nơi lạ:
 * mọi ảnh phải nằm trên CDN của hãng hoặc Unsplash.
 */
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { SEED_IMAGES, type SeedImage } from "./seed-manifest.js";

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

/** Nơi ảnh được phép nằm: CDN chính hãng và ảnh chụp miễn phí bản quyền */
const ALLOWED_HOSTS = [
  "assets.corsair.com",
  "images.samsung.com",
  "www.amd.com",
  "dlcdnwebimgs.asus.com",
  "static.gigabyte.com",
  "resource.logitechg.com",
  "images.unsplash.com",
];
const LENOVO_CDN = /^p[1-4]-ofp\.static\.pub$/;

const urlOf = (image: SeedImage) => (typeof image === "string" ? image : image.url);

const seedSource = fs.readFileSync(
  fileURLToPath(new URL("../../../../packages/db/prisma/seed.ts", import.meta.url)),
  "utf8",
);

/** Slug các sản phẩm trong mảng `products` của seed.ts (khác slug danh mục ở phần đầu file) */
function seedProductSlugs(): string[] {
  const start = seedSource.indexOf("const products: ProductSeed[] = [");
  const end = seedSource.indexOf("\n];", start);
  const block = seedSource.slice(start, end);
  return [...block.matchAll(/^ {4}slug: "([^"]+)"/gm)].map((match) => match[1]);
}

console.log("\n[1] Đối chiếu với seed.ts");
{
  const productSlugs = seedProductSlugs();
  const manifestSlugs = SEED_IMAGES.map((set) => set.slug);

  check("đọc được danh sách sản phẩm trong seed.ts", productSlugs.length > 0, true);
  check("mỗi slug trong manifest đều là sản phẩm có thật", manifestSlugs.filter((s) => !productSlugs.includes(s)), []);
  check("mọi sản phẩm mẫu đều có bộ ảnh", productSlugs.filter((s) => !manifestSlugs.includes(s)), []);
  check("không có slug lặp", new Set(manifestSlugs).size, manifestSlugs.length);
}

console.log("\n[2] Từng bộ ảnh");
{
  for (const set of SEED_IMAGES) {
    const urls = set.images.map(urlOf);
    const problems: string[] = [];

    if (urls.length < 1 || urls.length > 8) problems.push(`số ảnh ${urls.length} ngoài khoảng 1-8`);
    if (new Set(urls).size !== urls.length) problems.push("có URL lặp");
    if (!/^[A-Z][A-Z0-9]*$/.test(set.source)) problems.push(`source "${set.source}" phải viết hoa`);

    for (const target of [set.sourceUrl, ...set.images.flatMap((i) => (typeof i === "string" ? [] : [i.page]))]) {
      if (!target.startsWith("https://")) problems.push(`trang gốc không phải https: ${target}`);
    }

    for (const url of urls) {
      let host = "";
      try {
        const parsed = new URL(url);
        host = parsed.hostname;
        if (parsed.protocol !== "https:") problems.push(`không phải https: ${url}`);
      } catch {
        problems.push(`URL không hợp lệ: ${url}`);
        continue;
      }
      if (!ALLOWED_HOSTS.includes(host) && !LENOVO_CDN.test(host)) problems.push(`nguồn ảnh lạ (${host})`);
    }

    check(set.slug, problems, []);
  }
}

console.log(`\nKết quả: ${passed} đạt, ${failed} lỗi`);
process.exit(failed ? 1 : 0);
