/**
 * Adapter theo hãng.
 *
 * Mỗi hãng chỉ khai báo hai thứ:
 *   1. Nguồn danh mục   — sitemap hoặc trang liệt kê, để dựng bảng model -> URL
 *   2. Cách trích ảnh   — host CDN nào là ảnh sản phẩm thật
 *
 * Mọi việc còn lại (HTTP, cache, so khớp, tải ảnh, chuyển WebP) do tầng chung lo.
 * Thêm MSI hay ASUS về sau là thêm một khối như dưới đây, không phải một file mới.
 */
import * as cheerio from "cheerio";
import type { CatalogEntry } from "./normalize.js";
import { loadCatalog, loadFromListing, loadFromSitemap } from "./catalog.js";

export interface ResolvedImage {
  url: string;
  alt: string;
}

export interface BrandAdapter {
  key: string;
  /** Tên hãng như xuất hiện trong Product.name — dùng để lọc sản phẩm từ DB */
  brandNames: string[];
  loadCatalog(): Promise<CatalogEntry[]>;
  extractImages(html: string, pageUrl: string, model: string): ResolvedImage[];
}

/** Đọc thẻ og:image — cả hai hãng đều trỏ đúng ảnh sản phẩm chính ở đây. */
function ogImage($: cheerio.CheerioAPI, pageUrl: string): string | null {
  const raw =
    $('meta[property="og:image"]').attr("content") ??
    $('meta[name="og:image"]').attr("content");
  if (!raw) return null;
  try {
    return new URL(raw.trim(), pageUrl).toString();
  } catch {
    return null;
  }
}

/**
 * Chỉ cần đọc thuộc tính, nên khai báo đúng phần dùng tới thay vì mượn kiểu
 * của cheerio. Cheerio 1.x không export `Element` nữa (kiểu đó đã chuyển sang
 * gói `domhandler`), nên cách này tránh vỡ khi nâng cấp thư viện.
 */
interface AttrReader {
  attr(name: string): string | undefined;
}

/** Gom mọi thuộc tính có thể chứa URL ảnh trên một thẻ <img>. */
function imgCandidates($img: AttrReader): string[] {
  const out: string[] = [];
  for (const attr of ["src", "data-src", "data-original", "data-lazy", "data-zoom-image"]) {
    const v = $img.attr(attr);
    if (v) out.push(v);
  }
  const srcset = $img.attr("srcset");
  if (srcset) {
    for (const part of srcset.split(",")) {
      const first = part.trim().split(/\s+/)[0];
      if (first) out.push(first);
    }
  }
  return out;
}

function collectImages(
  html: string,
  pageUrl: string,
  accept: (url: string) => boolean
): string[] {
  const $ = cheerio.load(html);
  const found = new Set<string>();

  const og = ogImage($, pageUrl);
  if (og && accept(og)) found.add(og);

  $("img").each((_, el) => {
    for (const raw of imgCandidates($(el))) {
      try {
        const abs = new URL(raw.trim(), pageUrl).toString();
        if (accept(abs)) found.add(abs);
      } catch {
        /* URL rác, bỏ qua */
      }
    }
  });

  return [...found];
}

// ===========================================================================
// GIGABYTE
// ===========================================================================
//
// Danh mục: sitemap_index.xml -> consumer-products -> global/sitemap.xml
// URL sản phẩm: https://www.gigabyte.com/Motherboard/B760M-GAMING-X-AX
//               https://www.gigabyte.com/Graphics-Card/...
//
// Đã kiểm chứng: URL KHÔNG cần hậu tố "-rev-10". Vòng lặp thử 9 revision trong
// code cũ gần như luôn thừa — mỗi sản phẩm tốn tới 9 request chỉ để tìm trang.
//
// Ảnh sản phẩm thật nằm ở static.gigabyte.com. Đường dẫn /FileUpload/ là ảnh
// minh hoạ tính năng và sơ đồ, KHÔNG phải ảnh sản phẩm — code cũ nhận nhầm
// nhóm này, đồng thời lại lọc `endsWith("/hero.png")` nên đa số trả về rỗng.

const GIGABYTE_PRODUCT_PATH = /^\/(Motherboard|Graphics-Card)\/[^/]+\/?$/i;

export const gigabyteAdapter: BrandAdapter = {
  key: "gigabyte",
  brandNames: ["GIGABYTE", "AORUS"],

  loadCatalog() {
    return loadCatalog("gigabyte", () =>
      loadFromSitemap({
        sitemapUrl: "https://www.gigabyte.com/sitemap_index.xml",

        // Sitemap lồng nhiều tầng và có ~66 thị trường. Chỉ lấy bản global,
        // nếu không sẽ tải trùng dữ liệu 66 lần.
        pickChildSitemap: (url) =>
          /consumer-products/i.test(url) &&
          (/\/global\//i.test(url) || /consumer-products\/sitemap_index\.xml$/i.test(url)),

        isProductUrl: (url) => {
          try {
            const u = new URL(url);
            if (!/(^|\.)gigabyte\.com$/i.test(u.hostname)) return false;
            return GIGABYTE_PRODUCT_PATH.test(u.pathname);
          } catch {
            return false;
          }
        },

        modelFromUrl: (url) => {
          try {
            const slug = decodeURIComponent(
              new URL(url).pathname.split("/").filter(Boolean).pop() ?? ""
            );
            if (!slug) return null;
            // "B760M-GAMING-X-AX-rev-10" -> "B760M GAMING X AX"
            return slug
              .replace(/-rev-[0-9]+$/i, "")
              .replace(/-/g, " ")
              .trim();
          } catch {
            return null;
          }
        },
      })
    );
  },

  extractImages(html, pageUrl, model) {
    const urls = collectImages(html, pageUrl, (url) => {
      const lower = url.toLowerCase();
      if (!lower.includes("static.gigabyte.com")) return false;
      // loại icon, logo, biểu ngữ
      if (/\b(icon|logo|banner|award|badge)\b/.test(lower)) return false;
      return true;
    });

    return urls.map((url) => ({ url, alt: `${model} - Official GIGABYTE` }));
  },
};

// ===========================================================================
// ASROCK
// ===========================================================================
//
// Hãng này KHÔNG công bố sitemap (robots.txt chỉ chặn /asrockrack/), nên dùng
// trang liệt kê sản phẩm làm nguồn danh mục.
//
// URL sản phẩm: /mb/{Intel|AMD}/{Model}/index.asp
//               /Graphics-Card/{Intel|AMD}/{Model}/index.asp
//
// Ảnh: /mb/photo/{Model}(M1).png là ảnh chính, kèm (S1)...(S6) là ảnh phụ.
// Code cũ chỉ đoán đúng (M1) và bỏ qua 6 ảnh còn lại.

const ASROCK_PRODUCT_PATH = /^\/(mb|graphics-card)\/[^/]+\/[^/]+\/index\.asp$/i;

function asrockModelFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split("/").filter(Boolean);
    const i = parts.findIndex((p) => p.toLowerCase() === "index.asp");
    if (i <= 0) return null;
    return decodeURIComponent(parts[i - 1]).trim() || null;
  } catch {
    return null;
  }
}

/** Thứ tự ảnh: (M1) trước, rồi (S1), (S2)... */
function asrockImageRank(url: string): number {
  const m = /\((M|S)(\d+)\)\.[a-z]+$/i.exec(decodeURIComponent(url));
  if (!m) return 999;
  return (m[1].toUpperCase() === "M" ? 0 : 100) + Number(m[2]);
}

export const asrockAdapter: BrandAdapter = {
  key: "asrock",
  brandNames: ["ASROCK"],

  loadCatalog() {
    return loadCatalog("asrock", () =>
      loadFromListing({
        listingUrls: [
          "https://www.asrock.com/mb/index.asp",
          "https://www.asrock.com/Graphics-Card/index.asp",
        ],
        // Không bám vào class CSS (dễ đổi) — quét mọi link rồi lọc bằng đường dẫn
        linkSelector: "a[href]",
        isProductUrl: (url) => {
          try {
            const u = new URL(url);
            if (!/(^|\.)asrock\.com$/i.test(u.hostname)) return false;
            if (/\/asrockrack\//i.test(u.pathname)) return false; // robots.txt chặn
            return ASROCK_PRODUCT_PATH.test(u.pathname);
          } catch {
            return false;
          }
        },
        modelFrom: (url) => asrockModelFromUrl(url),
      })
    );
  },

  extractImages(html, pageUrl, model) {
    const urls = collectImages(html, pageUrl, (url) => {
      const lower = url.toLowerCase();
      if (!/(^|\.)asrock\.com/.test(new URL(url).hostname)) return false;
      if (!lower.includes("/photo/")) return false;
      if (/\b(icon|logo|banner|award|badge)\b/.test(lower)) return false;
      return true;
    });

    return urls
      .sort((a, b) => asrockImageRank(a) - asrockImageRank(b))
      .map((url) => ({ url, alt: `${model} - Official ASRock` }));
  },
};

// ===========================================================================

export const ADAPTERS: BrandAdapter[] = [gigabyteAdapter, asrockAdapter];

export function adapterForProductName(name: string): BrandAdapter | null {
  const upper = name.toUpperCase();
  return (
    ADAPTERS.find((a) => a.brandNames.some((b) => upper.includes(b))) ?? null
  );
}