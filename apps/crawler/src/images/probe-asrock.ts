/**
 * Chẩn đoán vì sao danh mục ASRock dựng ra 0 model.
 * Chạy: npx tsx src/images/probe-asrock.ts
 *
 * Script này chỉ ĐỌC và IN RA, không ghi gì cả. Mục đích là xem trang liệt kê
 * của ASRock thực sự trả về cái gì, để biết vấn đề nằm ở đâu:
 *
 *   - HTML rỗng / quá ngắn        -> bị chặn, hoặc trang dựng bằng JavaScript
 *   - Có link nhưng không khớp mẫu -> mẫu đường dẫn tôi đoán bị sai
 *   - Không có thẻ <a> nào         -> nội dung nạp bằng AJAX
 */
import * as cheerio from "cheerio";
import { fetchText } from "./catalog.js";

const LISTING = "https://www.asrock.com/mb/index.asp";
const PRODUCT_PATH = /^\/(mb|graphics-card)\/[^/]+\/[^/]+\/index\.asp$/i;

async function main() {
  console.log("Đang tải:", LISTING, "\n");

  let html: string;
  try {
    html = await fetchText(LISTING);
  } catch (error) {
    console.error("✗ Không tải được trang:");
    console.error(error instanceof Error ? error.message : error);
    return;
  }

  console.log("Độ dài HTML:", html.length, "ký tự");

  if (html.length < 5000) {
    console.log("\n⚠ HTML quá ngắn — nhiều khả năng bị chặn hoặc chuyển hướng.");
    console.log("--- Toàn bộ nội dung ---");
    console.log(html.slice(0, 2000));
    return;
  }

  const $ = cheerio.load(html);
  const all = $("a[href]");
  console.log("Tổng số thẻ <a href>:", all.length);

  const hrefs: string[] = [];
  all.each((_, el) => {
    const href = $(el).attr("href");
    if (href) hrefs.push(href);
  });

  // Link nào có chữ index.asp
  const withIndexAsp = hrefs.filter((h) => /index\.asp/i.test(h));
  console.log("Link chứa 'index.asp':", withIndexAsp.length);

  // Link nào khớp mẫu trang sản phẩm
  let matched = 0;
  const samples: string[] = [];

  for (const href of hrefs) {
    let abs: string;
    try {
      abs = new URL(href, LISTING).toString();
    } catch {
      continue;
    }
    const pathname = new URL(abs).pathname;
    if (PRODUCT_PATH.test(pathname)) {
      matched++;
      if (samples.length < 5) samples.push(abs);
    }
  }

  console.log("Link khớp mẫu trang sản phẩm:", matched);

  if (matched > 0) {
    console.log("\nVí dụ link khớp:");
    samples.forEach((s) => console.log("  ", s));
    console.log("\n=> Mẫu đường dẫn ĐÚNG. Vấn đề nằm chỗ khác.");
    return;
  }

  // Không khớp cái nào — in ra các link chứa /mb/ để xem dạng thật
  console.log("\n✗ Không link nào khớp mẫu. Các link chứa '/mb/':");
  const mbLinks = [...new Set(hrefs.filter((h) => /\/mb\//i.test(h)))];
  mbLinks.slice(0, 25).forEach((h) => console.log("  ", h));
  console.log(`  (tổng ${mbLinks.length} link)`);

  if (mbLinks.length === 0) {
    console.log("\nKhông có link /mb/ nào. 20 link đầu tiên trên trang:");
    [...new Set(hrefs)].slice(0, 20).forEach((h) => console.log("  ", h));
    console.log(
      "\n=> Trang nhiều khả năng nạp danh sách sản phẩm bằng JavaScript/AJAX,"
    );
    console.log("   nên HTML tĩnh không chứa link sản phẩm.");
  }

  // Tìm dấu vết của API nội bộ, nếu có
  const apiHints = [...html.matchAll(/["'](\/[^"']*(?:ajax|json|api|getproduct)[^"']*)["']/gi)]
    .map((m) => m[1])
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 10);

  if (apiHints.length) {
    console.log("\nCó thể trang gọi các đường dẫn này để lấy dữ liệu:");
    apiHints.forEach((h) => console.log("  ", h));
  }
}

main().catch(console.error);