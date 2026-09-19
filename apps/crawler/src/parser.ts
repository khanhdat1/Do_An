import * as cheerio from "cheerio";
import type { CategoryConfig, ScrapedProduct } from "./types.js";
import { absoluteUrl, cleanText, parseVnd, toSlug, unique } from "./utils.js";
import { BASE_URL } from "./config.js";

const blockedPathParts = [
  "/gio-hang",
  "/dang-nhap",
  "/dang-ky",
  "/tin-tuc",
  "/lien-he",
  "/build-pc",
  "/so-sanh",
  "/thuong-hieu",
  "/search",
  "/tim-kiem",
];

function looksLikeProductUrl(url: string, category: CategoryConfig): boolean {
  try {
    const u = new URL(url);
    if (!/^(www\.)?kccshop\.vn$/i.test(u.hostname)) return false;
    if (u.href === category.url || u.pathname === new URL(category.url).pathname) return false;
    if (blockedPathParts.some((part) => u.pathname.includes(part))) return false;

    // KCCShop product pages are normally top-level slugs such as /mainboard-asrock-.../
    const parts = u.pathname.split("/").filter(Boolean);
    return parts.length === 1;
  } catch {
    return false;
  }
}

export function extractProductLinks(html: string, category: CategoryConfig): string[] {
  const $ = cheerio.load(html);
  const links: string[] = [];

  const preferredSelectors = [
    ".product-item a[href]",
    ".p-item a[href]",
    ".item-product a[href]",
    ".product a[href]",
    "[class*=product] a[href]",
  ];

  for (const selector of preferredSelectors) {
    $(selector).each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const url = absoluteUrl(BASE_URL, href);
      if (!url || !looksLikeProductUrl(url, category)) return;

      const text = cleanText($(el).text()) || cleanText($(el).find("img").attr("alt"));
      if (text && category.keywords.test(text)) links.push(url);
    });
  }

  // Fallback for category markup changes.
  if (links.length < 5) {
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      const url = absoluteUrl(BASE_URL, href);
      if (!url || !looksLikeProductUrl(url, category)) return;

      const text = cleanText($(el).text()) || cleanText($(el).find("img").attr("alt"));
      if (text.length >= 8 && category.keywords.test(text)) links.push(url);
    });
  }

  return unique(links.map((url) => url.split("#")[0]));
}

function extractName($: cheerio.CheerioAPI): string {
  return cleanText($("h1").first().text()) || cleanText($("title").text().split("|")[0]);
}

function extractBrand($: cheerio.CheerioAPI, bodyText: string): string | null {
  const brandLink = $("a").filter((_, el) => {
    const prev = cleanText($(el).parent().text());
    return /thương hiệu/i.test(prev);
  }).first();
  const fromLink = cleanText(brandLink.text());
  if (fromLink && fromLink.length <= 40) return fromLink;

  const match = bodyText.match(/Thương hiệu\s*:\s*([^|\n]{2,40})/i);
  return match ? cleanText(match[1]) : null;
}

function extractPrices(bodyText: string): { price: number | null; originalPrice: number | null } {
  const promo = bodyText.match(/Giá khuyến mại\s*:\s*([\d.]+\s*(?:đ|₫))/i);
  const original = bodyText.match(/Giá gốc\s*:\s*([\d.]+\s*(?:đ|₫))/i);
  if (promo || original) {
    return {
      price: parseVnd(promo?.[1]),
      originalPrice: parseVnd(original?.[1]),
    };
  }

  const sale = bodyText.match(/Giá bán\s*([\d.]+\s*(?:đ|₫))/i);
  const list = bodyText.match(/Giá niêm yết\s*([\d.]+\s*(?:đ|₫))/i);
  if (sale || list) {
    return { price: parseVnd(sale?.[1]), originalPrice: parseVnd(list?.[1]) };
  }

  const all = [...bodyText.matchAll(/([\d.]{4,})\s*(?:đ|₫)/gi)]
    .map((m) => parseVnd(m[0]))
    .filter((n): n is number => n !== null && n >= 10_000);

  if (!all.length) return { price: null, originalPrice: null };
  return { price: Math.min(...all), originalPrice: Math.max(...all) };
}

function extractStock(bodyText: string): ScrapedProduct["stockStatus"] {
  if (/tình trạng\s*:\s*còn hàng|✓\s*còn hàng|\bcòn hàng\b/i.test(bodyText)) return "IN_STOCK";
  if (/hết hàng|tạm hết/i.test(bodyText)) return "OUT_OF_STOCK";
  if (/đặt trước|pre-?order/i.test(bodyText)) return "PREORDER";
  return "UNKNOWN";
}

function extractWarranty(bodyText: string): number | null {
  const match = bodyText.match(/Bảo hành\s*:?\s*(\d{1,3})\s*tháng/i);
  return match ? Number(match[1]) : null;
}

function extractImages($: cheerio.CheerioAPI, name: string): ScrapedProduct["images"] {
  const result: ScrapedProduct["images"] = [];
  $("img").each((_, el) => {
    const alt = cleanText($(el).attr("alt"));
    const raw = $(el).attr("data-src") || $(el).attr("data-lazy-src") || $(el).attr("src");
    if (!raw) return;
    if (!alt || (!alt.toLowerCase().includes(name.toLowerCase().slice(0, 18)) && !/mainboard|cpu|ram|vga|ssd|case|nguồn|psu/i.test(alt))) return;

    const url = absoluteUrl(BASE_URL, raw);
    if (!url || /icon|logo|avatar|loading|placeholder/i.test(url)) return;
    result.push({ url, alt });
  });

  return result.filter((img, i, arr) => arr.findIndex((x) => x.url === img.url) === i).slice(0, 10);
}

function extractShortSpecs($: cheerio.CheerioAPI): string[] {
  const candidates: string[] = [];

  $("li, p").each((_, el) => {
    const text = cleanText($(el).text());
    if (!text || text.length < 8 || text.length > 220) return;
    if (/^(hỗ trợ|chipset|\d+\s*x|ram|cpu|socket|lan|mạng|âm thanh|đồ họa|kết nối|pci|m\.2|ddr|wifi|bluetooth)/i.test(text)) {
      candidates.push(text);
    }
  });

  return unique(candidates).slice(0, 15);
}

function extractSpecifications($: cheerio.CheerioAPI): Record<string, string> {
  const specs: Record<string, string> = {};

  $("table tr").each((_, row) => {
    const cells = $(row).find("th,td").map((__, c) => cleanText($(c).text())).get().filter(Boolean);
    if (cells.length < 2) return;
    const key = cells[0];
    const value = cells.slice(1).join(" | ");
    if (key.length > 100 || value.length < 1 || value.length > 4000) return;
    if (/giá|tình trạng|bảo hành/i.test(key) && value.length < 40) return;
    specs[key] = value;
  });

  // Some KCCShop pages present specification rows as neighboring blocks instead of a pure table.
  if (Object.keys(specs).length < 4) {
    const knownKeys = ["CPU", "Chipset", "Memory", "RAM", "BIOS", "Graphics", "Audio", "LAN", "Storage", "USB", "Connector", "Rear Panel I/O", "Form Factor"];
    const text = cleanText($.root().text());
    for (const key of knownKeys) {
      const re = new RegExp(`${key}\\s*[|:]\\s*(.{10,600}?)(?=${knownKeys.filter(k => k !== key).map(k => `\\b${k}\\b\\s*[|:]`).join("|")}|THÔNG SỐ|$)`, "i");
      const m = text.match(re);
      if (m) specs[key] = cleanText(m[1]);
    }
  }

  return specs;
}

function extractDescription($: cheerio.CheerioAPI): string | null {
  const selectors = [".product-description", ".detail-content", ".content-detail", "[class*=description]"];
  for (const selector of selectors) {
    const text = cleanText($(selector).first().text());
    if (text.length >= 80) return text.slice(0, 8000);
  }
  return null;
}

export function parseProduct(html: string, sourceUrl: string, category: CategoryConfig): ScrapedProduct {
  const $ = cheerio.load(html);
  const bodyText = cleanText($("body").text());
  const name = extractName($);
  if (!name || name.length < 4) throw new Error(`Không đọc được tên sản phẩm: ${sourceUrl}`);

  const { price, originalPrice } = extractPrices(bodyText);

  return {
    name,
    slug: toSlug(name),
    sourceUrl,
    category: { name: category.name, slug: category.slug },
    brand: extractBrand($, bodyText),
    price,
    originalPrice,
    stockStatus: extractStock(bodyText),
    warrantyMonths: extractWarranty(bodyText),
    shortSpecs: extractShortSpecs($),
    specifications: extractSpecifications($),
    description: extractDescription($),
    images: extractImages($, name),
  };
}
