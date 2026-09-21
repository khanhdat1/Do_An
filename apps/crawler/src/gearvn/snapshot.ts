/**
 * Bản chụp dữ liệu demo (`apps/crawler/data/demo-catalog.json`).
 *
 * Tách thu thập khỏi nạp DB làm hai bước:
 *
 *   collect.ts  →  demo-catalog.json  →  load.ts (npm run demo-data)
 *   (cần mạng)     (đưa vào git)         (chạy offline, lặp lại bao nhiêu lần cũng được)
 *
 * Nhờ vậy người chấm hay bạn cùng nhóm clone repo về chạy `npm run demo-data` là có đủ
 * ~130 sản phẩm mà không phải cào lại; và khi GEARVN đổi giao diện, dữ liệu đã chụp vẫn còn.
 * File chỉ chứa SỰ THẬT về sản phẩm (tên, giá, thông số, địa chỉ ảnh) — phần mô tả bán hàng
 * do PCZone tự viết ở describe.ts, không sao chép chữ của nguồn.
 */
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { ProductAttribute } from "./rsc.js";

export const SNAPSHOT_PATH = fileURLToPath(new URL("../../data/demo-catalog.json", import.meta.url));

export interface CatalogItem {
  /** Slug danh mục của PCZone: cpu, vga, man-hinh... */
  category: string;
  /** Trang sản phẩm gốc — cũng là khoá chống trùng (Product.sourceUrl) */
  sourceUrl: string;
  /** Tên gốc trên nguồn, chưa làm sạch */
  name: string;
  brand: string | null;
  /** Giá bán tại thời điểm thu thập (VNĐ) */
  price: number;
  /** Giá niêm yết trước giảm; null nếu không giảm */
  listPrice: number | null;
  /** Địa chỉ ảnh gốc, ảnh chính đứng đầu */
  images: string[];
  /** Bảng thông số đầy đủ theo thứ tự của nguồn */
  attributes: ProductAttribute[];
  /** Thông số nổi bật ngắn ở trang danh sách, dùng khi bảng đầy đủ thiếu */
  highlights: string[];
}

export interface Catalog {
  source: "GEARVN";
  /** Ngày thu thập, dạng YYYY-MM-DD */
  collectedAt: string;
  note: string;
  products: CatalogItem[];
}

export const BLOCKLIST_PATH = fileURLToPath(new URL("../../data/image-blocklist.json", import.meta.url));

/**
 * Ảnh đã xem bằng mắt và loại khỏi bộ demo (ảnh quảng cáo nhiều chữ, ảnh ghép huy hiệu đè lên sản phẩm).
 * Nằm riêng khỏi bản chụp để chạy lại `collect-demo` không làm ảnh xấu quay lại. Không có file thì coi như rỗng.
 */
export async function readImageBlocklist(): Promise<Set<string>> {
  try {
    const parsed = JSON.parse(await fs.readFile(BLOCKLIST_PATH, "utf8")) as { entries?: { url: string }[] };
    return new Set((parsed.entries ?? []).map((entry) => entry.url));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Set();
    throw error;
  }
}

export async function readCatalog(): Promise<Catalog> {
  try {
    return JSON.parse(await fs.readFile(SNAPSHOT_PATH, "utf8")) as Catalog;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `Chưa có ${SNAPSHOT_PATH}. Chạy \`npm run collect-demo\` để thu thập (cần mạng), hoặc lấy file này từ git.`,
      );
    }
    throw error;
  }
}

export async function writeCatalog(catalog: Catalog): Promise<void> {
  await fs.mkdir(new URL("../../data/", import.meta.url), { recursive: true });
  await fs.writeFile(SNAPSHOT_PATH, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
}
