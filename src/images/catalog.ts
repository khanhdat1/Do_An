/**
 * Dựng "danh mục model" của một hãng: danh sách cặp (model, URL trang sản phẩm).
 *
 * Đây là thay đổi cốt lõi so với code cũ. Trước đây mỗi hãng tự ĐOÁN URL:
 *
 *   ASRock:   `/mb/${platform}/${model}/index.asp`       (đoán theo quy ước)
 *   Gigabyte: thử `-rev-10` ... `-rev-21`                (9 request mỗi sản phẩm)
 *
 * Giờ ta ĐỌC link thật từ nguồn danh mục của hãng — sitemap hoặc trang liệt kê —
 * đúng một lần cho cả hãng, rồi so khớp trong bộ nhớ. 100 sản phẩm Gigabyte từ
 * ~900 request xuống còn 1 request.
 *
 * Kết quả được cache ra đĩa nên chạy lại trong ngày không cần tải lại.
 */
import fs from "node:fs/promises";
import path from "node:path";
import axios from "axios";
import * as cheerio from "cheerio";
import type { CatalogEntry } from "./normalize.js";

const CACHE_DIR = path.resolve(".cache/catalogs");
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 giờ

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

export async function fetchText(url: string, timeout = 30000): Promise<string> {
  const response = await axios.get<string>(url, {
    timeout,
    responseType: "text",
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    // sitemap có thể vài MB
    maxContentLength: 50 * 1024 * 1024,
  });
  return String(response.data);
}

// ---------------------------------------------------------------------------
// Cache đĩa
// ---------------------------------------------------------------------------

async function readCache(key: string): Promise<CatalogEntry[] | null> {
  try {
    const file = path.join(CACHE_DIR, `${key}.json`);
    const stat = await fs.stat(file);
    if (Date.now() - stat.mtimeMs > CACHE_TTL_MS) return null;
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return null;
  }
}

async function writeCache(key: string, entries: CatalogEntry[]): Promise<void> {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(
      path.join(CACHE_DIR, `${key}.json`),
      JSON.stringify(entries, null, 2),
      "utf8"
    );
  } catch {
    // cache hỏng không được làm chết tiến trình chính
  }
}

// ---------------------------------------------------------------------------
// Nguồn 1: sitemap XML (Gigabyte)
// ---------------------------------------------------------------------------

/** Lấy mọi <loc> trong một file sitemap hoặc sitemap index. */
function extractLocs(xml: string): string[] {
  const locs: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    locs.push(m[1].replace(/&amp;/g, "&").trim());
  }
  return locs;
}

export interface SitemapSourceOptions {
  /** URL sitemap index hoặc sitemap lá */
  sitemapUrl: string;
  /** Chỉ giữ sitemap con khớp mẫu này (VD chỉ lấy bản global) */
  pickChildSitemap?: (url: string) => boolean;
  /** Chỉ giữ URL sản phẩm khớp mẫu này */
  isProductUrl: (url: string) => boolean;
  /** Suy ra tên model từ URL sản phẩm */
  modelFromUrl: (url: string) => string | null;
}

export async function loadFromSitemap(
  opts: SitemapSourceOptions
): Promise<CatalogEntry[]> {
  const root = await fetchText(opts.sitemapUrl);
  let locs = extractLocs(root);

  // Nếu là sitemap index (trỏ tới các sitemap khác) thì đi tiếp một tầng
  const isIndex = /<sitemapindex/i.test(root);
  if (isIndex) {
    const children = opts.pickChildSitemap
      ? locs.filter(opts.pickChildSitemap)
      : locs;

    const all: string[] = [];
    for (const child of children) {
      try {
        const xml = await fetchText(child);
        // sitemap con có thể lại là index (Gigabyte lồng 2 tầng)
        if (/<sitemapindex/i.test(xml)) {
          const grand = opts.pickChildSitemap
            ? extractLocs(xml).filter(opts.pickChildSitemap)
            : extractLocs(xml);
          for (const g of grand) {
            all.push(...extractLocs(await fetchText(g)));
          }
        } else {
          all.push(...extractLocs(xml));
        }
      } catch (error) {
        console.warn(
          `  ⚠ Không đọc được sitemap con ${child}:`,
          error instanceof Error ? error.message : error
        );
      }
    }
    locs = all;
  }

  const seen = new Set<string>();
  const entries: CatalogEntry[] = [];

  for (const url of locs) {
    if (!opts.isProductUrl(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);

    const model = opts.modelFromUrl(url);
    if (model) entries.push({ model, url });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Nguồn 2: trang liệt kê HTML (ASRock — hãng này không công bố sitemap)
// ---------------------------------------------------------------------------

export interface ListingSourceOptions {
  /** Một hoặc nhiều trang danh sách sản phẩm */
  listingUrls: string[];
  /** Selector các thẻ <a> trỏ tới trang sản phẩm */
  linkSelector: string;
  /** Chỉ giữ URL sản phẩm khớp mẫu này */
  isProductUrl: (url: string) => boolean;
  /** Suy ra model từ URL và văn bản của link */
  modelFrom: (url: string, linkText: string) => string | null;
}

export async function loadFromListing(
  opts: ListingSourceOptions
): Promise<CatalogEntry[]> {
  const seen = new Set<string>();
  const entries: CatalogEntry[] = [];

  for (const listingUrl of opts.listingUrls) {
    const html = await fetchText(listingUrl);
    const $ = cheerio.load(html);

    $(opts.linkSelector).each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;

      let absolute: string;
      try {
        absolute = new URL(href, listingUrl).toString();
      } catch {
        return;
      }

      if (!opts.isProductUrl(absolute)) return;
      if (seen.has(absolute)) return;
      seen.add(absolute);

      const model = opts.modelFrom(absolute, $(el).text().trim());
      if (model) entries.push({ model, url: absolute });
    });
  }

  return entries;
}

// ---------------------------------------------------------------------------
// Bộ nhớ đệm chung
// ---------------------------------------------------------------------------

export async function loadCatalog(
  key: string,
  loader: () => Promise<CatalogEntry[]>
): Promise<CatalogEntry[]> {
  const cached = await readCache(key);
  if (cached && cached.length > 0) {
    console.log(`[danh mục ${key}] dùng cache: ${cached.length} model`);
    return cached;
  }

  console.log(`[danh mục ${key}] đang tải từ nguồn chính hãng...`);
  const entries = await loader();
  console.log(`[danh mục ${key}] đã dựng ${entries.length} model`);

  if (entries.length > 0) await writeCache(key, entries);
  return entries;
}