import "dotenv/config";
import type { CategoryConfig } from "./types.js";

export const BASE_URL = "https://kccshop.vn";

export const CRAWL_DELAY_MS = Number(process.env.CRAWL_DELAY_MS ?? 1500);
export const CRAWL_CONCURRENCY = Number(process.env.CRAWL_CONCURRENCY ?? 2);
export const MAX_PRODUCTS_PER_CATEGORY = Number(process.env.MAX_PRODUCTS_PER_CATEGORY ?? 30);

export const categories: CategoryConfig[] = [
  {
    name: "Mainboard",
    slug: "mainboard",
    url: `${BASE_URL}/main-bo-mach-chu/`,
    keywords: /\b(mainboard|bo mạch chủ)\b/i,
  },
  {
    name: "CPU",
    slug: "cpu",
    url: `${BASE_URL}/cpu-bo-vi-xu-ly/`,
    keywords: /\b(cpu|intel core|ryzen|xeon|pentium|threadripper)\b/i,
  },
  {
    name: "RAM",
    slug: "ram",
    url: `${BASE_URL}/ram-bo-nho-trong/`,
    keywords: /\b(ram|ddr[345])\b/i,
  },
  {
    name: "VGA",
    slug: "vga",
    url: `${BASE_URL}/vga-card-man-hinh/`,
    keywords: /\b(vga|card màn hình|geforce|rtx|radeon|rx\s?\d)\b/i,
  },
  {
    name: "SSD",
    slug: "ssd",
    url: `${BASE_URL}/o-cung-the-ran-ssd/`,
    keywords: /\b(ssd|nvme|solid state)\b/i,
  },
  {
    name: "Case",
    slug: "case",
    url: `${BASE_URL}/case-vo-may-tinh/`,
    keywords: /\b(case|vỏ máy tính)\b/i,
  },
  {
    name: "PSU",
    slug: "psu",
    url: `${BASE_URL}/psu-nguon-may-tinh/`,
    keywords: /\b(psu|nguồn máy tính|nguồn\s+\w+)\b/i,
  },
];
