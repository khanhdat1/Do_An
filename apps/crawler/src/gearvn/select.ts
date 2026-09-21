import { ALREADY_SEEDED, EXCLUDED_NAME, type CategoryPlan } from "./plan.js";
import type { ListingProduct } from "./rsc.js";

/**
 * Xoay vòng theo thương hiệu để bộ demo có nhiều hãng (bộ lọc "Thương hiệu" ở trang danh mục mới
 * có cái để chọn) thay vì 8 chiếc màn hình cùng một hãng chỉ vì hãng đó đứng đầu trang.
 * Trong từng hãng giữ thứ tự của nguồn (nguồn xếp hàng bán chạy lên trước).
 */
function interleaveByBrand(products: ListingProduct[]): ListingProduct[] {
  const byBrand = new Map<string, ListingProduct[]>();
  for (const product of products) {
    const key = (product.brand ?? "khác").toLowerCase();
    const list = byBrand.get(key) ?? [];
    list.push(product);
    byBrand.set(key, list);
  }

  const ranked: ListingProduct[] = [];
  const queues = [...byBrand.values()];
  while (queues.some((queue) => queue.length > 0)) {
    for (const queue of queues) {
      const next = queue.shift();
      if (next) ranked.push(next);
    }
  }
  return ranked;
}

const COLOURS =
  "black|white|red|blue|pink|green|grey|gray|silver|purple|yellow|orange|đen|trắng|đỏ|xanh(?: dương| lá| ngọc)?|hồng|tím|vàng|xám|bạc|cam|nâu|kem|nhiều màu";
const TRAILING_COLOURS = new RegExp(`(?:[\\s/,+-]+(?:${COLOURS}))+\\s*$`, "iu");

/**
 * Khoá "mẫu sản phẩm": tên bỏ phần trong ngoặc (mã hàng, phiên bản) và các từ màu ở cuối. Nguồn bán mỗi màu
 * một trang ("Ghế … OC03 Đen", "Ghế … OC03 Xám Bạc"), nhưng trong bộ demo mười ba màu của cùng một chiếc ghế
 * chỉ là mười ba dòng lặp; các mẫu khác nhau cho bộ lọc và trang danh mục nhiều thứ để xem hơn.
 */
export function modelKey(name: string): string {
  return name
    .normalize("NFC")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(TRAILING_COLOURS, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * Xếp thứ tự ứng viên cho một danh mục: lọc hàng không hợp, rồi ưu tiên
 *   1. mẫu chưa có, còn hàng   2. mẫu chưa có, đang hết hàng   3. thêm màu của mẫu đã có (còn hàng)   4. (hết hàng).
 * Hàng hết vẫn là sản phẩm thật có ảnh và thông số (tồn kho demo do PCZone tự đặt), nên dùng làm phương án
 * bù khi hàng còn không đủ, như SSD, loa, bàn chỉ còn vài mẫu.
 *
 * `known`: khoá mẫu của các sản phẩm danh mục này đã có (chạy bổ sung), để không lấy thêm màu khác của chúng
 * khi còn mẫu mới.
 *
 * Trả về TOÀN BỘ ứng viên hợp lệ theo thứ tự ưu tiên; nơi gọi lấy dần cho đến khi đủ số
 * lượng, nên một trang sản phẩm lỗi chỉ làm nhường chỗ cho ứng viên kế tiếp.
 */
export function rankCandidates(candidates: ListingProduct[], plan: CategoryPlan, known: ReadonlySet<string> = new Set()): ListingProduct[] {
  const usable = candidates.filter(
    (product) =>
      product.imageUrl !== null &&
      product.price >= plan.minPrice &&
      product.price <= plan.maxPrice &&
      plan.nameMatches.test(product.name) &&
      !plan.nameExcludes?.test(product.name) &&
      !EXCLUDED_NAME.test(product.name) &&
      !ALREADY_SEEDED.test(product.name),
  );

  const seen = new Set(known);
  const uniqueInStock: ListingProduct[] = [];
  const uniqueSoldOut: ListingProduct[] = [];
  const variantInStock: ListingProduct[] = [];
  const variantSoldOut: ListingProduct[] = [];

  // Hàng còn xét trước: nếu một mẫu có cả màu còn lẫn màu hết thì màu còn được coi là bản chính
  for (const inStock of [true, false]) {
    for (const product of usable.filter((candidate) => candidate.inStock === inStock)) {
      const key = modelKey(product.name);
      const isVariant = seen.has(key);
      seen.add(key);
      (inStock ? (isVariant ? variantInStock : uniqueInStock) : isVariant ? variantSoldOut : uniqueSoldOut).push(product);
    }
  }

  return [
    ...interleaveByBrand(uniqueInStock),
    ...interleaveByBrand(uniqueSoldOut),
    ...interleaveByBrand(variantInStock),
    ...interleaveByBrand(variantSoldOut),
  ];
}
