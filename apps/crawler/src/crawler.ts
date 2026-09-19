import pLimit from "p-limit";

import {
  categories,
  CRAWL_CONCURRENCY,
  MAX_PRODUCTS_PER_CATEGORY,
} from "./config.js";

import { getHtml } from "./http.js";

import {
  extractProductLinks,
  parseProduct,
} from "./parser.js";

import { upsertProduct } from "./db.js";

import type {
  CategoryConfig,
} from "./types.js";

/**
 * Tạo URL phân trang KCCShop
 *
 * Ví dụ:
 * https://kccshop.vn/main-bo-mach-chu/?page=2&sort=new
 */
function buildPageUrl(
  categoryUrl: string,
  page: number
): string {
  const url = new URL(categoryUrl);

  url.searchParams.set("page", String(page));

  // Giữ thứ tự ổn định giữa các trang
  if (!url.searchParams.has("sort")) {
    url.searchParams.set("sort", "new");
  }

  return url.toString();
}

/**
 * Thu thập URL sản phẩm qua nhiều trang.
 *
 * Dừng khi:
 * - đủ maxProducts
 * - trang không còn sản phẩm
 * - trang mới không thêm URL nào
 * - vượt maxPages
 */
async function collectProductLinks(
  category: CategoryConfig,
  maxProducts: number
): Promise<string[]> {
  const links = new Set<string>();

  // Chặn crawler chạy vô hạn nếu website lỗi pagination
  const maxPages = 20;

  for (
    let page = 1;
    page <= maxPages && links.size < maxProducts;
    page++
  ) {
    const pageUrl = buildPageUrl(
      category.url,
      page
    );

    console.log(
      `\n[Trang ${page}] ${pageUrl}`
    );

    const html = await getHtml(pageUrl);

    const pageLinks = extractProductLinks(
      html,
      category
    );

    console.log(
      `Tìm thấy ${pageLinks.length} URL ở trang ${page}.`
    );

    if (pageLinks.length === 0) {
      console.log(
        "Không còn sản phẩm. Dừng phân trang."
      );

      break;
    }

    const before = links.size;

    for (const url of pageLinks) {
      links.add(url);

      if (links.size >= maxProducts) {
        break;
      }
    }

    const added = links.size - before;

    console.log(
      `Thêm mới ${added} URL. Tổng hiện tại: ${links.size}/${maxProducts}`
    );

    // Nếu sang trang mới nhưng toàn URL trùng
    // => có thể đã đến cuối pagination
    if (added === 0) {
      console.log(
        "Trang này không có URL mới. Dừng."
      );

      break;
    }
  }

  return [...links].slice(
    0,
    maxProducts
  );
}

export async function crawlCategory(
  category: CategoryConfig,
  maxProducts = MAX_PRODUCTS_PER_CATEGORY
) {
  console.log(
    `\n[Danh mục] ${category.name}: ${category.url}`
  );

  /*
   * Thay vì chỉ đọc category.url một lần,
   * crawler sẽ tự đi qua page 1, 2, 3...
   */
  const links =
    await collectProductLinks(
      category,
      maxProducts
    );

  console.log(
    `\nTổng cộng tìm thấy ${links.length} URL sản phẩm.`
  );

  const limit = pLimit(
    CRAWL_CONCURRENCY
  );

  let ok = 0;
  let failed = 0;

  await Promise.all(
    links.map((url, index) =>
      limit(async () => {
        try {
          const html =
            await getHtml(url);

          const product =
            parseProduct(
              html,
              url,
              category
            );

          await upsertProduct(product);

          ok++;

          console.log(
            `[${index + 1}/${links.length}] ✓ ${product.name} - ${
              product.price ??
              "chưa có giá"
            }`
          );
        } catch (error) {
          failed++;

          console.error(
            `[${index + 1}/${links.length}] ✗ ${url}`
          );

          console.error(
            error instanceof Error
              ? error.message
              : error
          );
        }
      })
    )
  );

  return {
    category: category.name,
    found: links.length,
    ok,
    failed,
  };
}

export async function crawlAll() {
  const reports = [];

  for (const category of categories) {
    reports.push(
      await crawlCategory(category)
    );
  }

  return reports;
}