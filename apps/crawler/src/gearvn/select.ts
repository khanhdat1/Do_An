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

/**
 * Xếp thứ tự ứng viên cho một danh mục: lọc hàng không hợp, hàng còn ưu tiên trước rồi mới tới
 * hàng đang hết (linh kiện khan hiếm như SSD có lúc chỉ còn vài mẫu; mẫu hết hàng vẫn là sản phẩm
 * thật có ảnh và thông số, còn tồn kho demo do PCZone tự đặt).
 *
 * Trả về TOÀN BỘ ứng viên hợp lệ theo thứ tự ưu tiên; nơi gọi lấy dần cho đến khi đủ số
 * lượng, nên một trang sản phẩm lỗi chỉ làm nhường chỗ cho ứng viên kế tiếp.
 */
export function rankCandidates(candidates: ListingProduct[], plan: CategoryPlan): ListingProduct[] {
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

  return [
    ...interleaveByBrand(usable.filter((product) => product.inStock)),
    ...interleaveByBrand(usable.filter((product) => !product.inStock)),
  ];
}
