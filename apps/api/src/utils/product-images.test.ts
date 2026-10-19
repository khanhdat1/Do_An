// Kiểm thử phần logic thuần của quản lý ảnh sản phẩm (không cần DB/ổ đĩa). Chạy: npx tsx src/utils/product-images.test.ts
import { join, resolve } from "node:path";
import {
  checkImageCapacity,
  checkReorder,
  describeUploadedFile,
  filesOfLocalPath,
  findDuplicateUpload,
  isAllowedProductImageType,
  moveToFront,
  normalizeImageOrder,
  PRODUCT_IMAGE_MAX_PER_PRODUCT,
  resolveInsideDir,
  sortByStoredOrder,
} from "./product-images.js";

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

console.log("\n[1] Loại ảnh được nhận");
check("JPEG", isAllowedProductImageType("image/jpeg"), true);
check("PNG", isAllowedProductImageType("image/png"), true);
check("WEBP", isAllowedProductImageType("image/webp"), true);
check("GIF (banner nhận, ảnh sản phẩm thì không)", isAllowedProductImageType("image/gif"), false);
check("SVG (có thể chứa script)", isAllowedProductImageType("image/svg+xml"), false);
check("PDF", isAllowedProductImageType("application/pdf"), false);
check("không bị lừa bởi thuộc tính có sẵn của Object", isAllowedProductImageType("toString"), false);

console.log("\n[2] Tên tệp trong thông báo lỗi");
check("có tên", describeUploadedFile("ảnh mặt trước.png", 0), 'Tệp "ảnh mặt trước.png"');
check("tên trống → số thứ tự đếm từ 1", describeUploadedFile("  ", 2), "Tệp thứ 3");

console.log("\n[3] Chặn ảnh trùng nội dung (checksum)");
check("không trùng", findDuplicateUpload(["aaa", null], [{ checksum: "bbb", label: 'Tệp "b.png"' }]), null);
check(
  "trùng ảnh đã có của sản phẩm",
  findDuplicateUpload(["aaa"], [
    { checksum: "bbb", label: 'Tệp "b.png"' },
    { checksum: "aaa", label: 'Tệp "a-copy.png"' },
  ]),
  'Tệp "a-copy.png" trùng nội dung với một ảnh sản phẩm đã có',
);
check(
  "cùng một ảnh chọn hai lần trong một lượt (khác tên)",
  findDuplicateUpload([], [
    { checksum: "ccc", label: 'Tệp "c.png"' },
    { checksum: "ccc", label: 'Tệp "c (1).png"' },
  ]),
  'Tệp "c (1).png" trùng nội dung với tệp "c.png" trong cùng lượt tải',
);
check("ảnh cũ không có checksum (null) không bị coi là trùng", findDuplicateUpload([null, null], [{ checksum: "ddd", label: "x" }]), null);

console.log("\n[4] Giới hạn số ảnh của một sản phẩm");
check("vừa đủ trần", checkImageCapacity(PRODUCT_IMAGE_MAX_PER_PRODUCT - 2, 2), null);
check("vượt trần → báo còn thêm được bao nhiêu", checkImageCapacity(18, 3, 20), "Mỗi sản phẩm tối đa 20 ảnh — hiện có 18 ảnh, chỉ thêm được 2 ảnh nữa");
check("đã đầy", checkImageCapacity(20, 1, 20), "Sản phẩm đã đủ 20 ảnh — xoá bớt ảnh cũ trước khi tải thêm");

console.log("\n[5] Thứ tự đang lưu");
{
  const t = (iso: string) => new Date(iso);
  const sorted = sortByStoredOrder([
    { id: "c", position: 1, createdAt: t("2026-01-01") },
    { id: "b", position: 0, createdAt: t("2026-01-02") },
    { id: "a", position: 1, createdAt: t("2025-12-31") },
  ]);
  check("theo position, trùng position thì ảnh cũ trước", sorted.map((image) => image.id), ["b", "a", "c"]);
}

console.log("\n[6] Chuẩn hoá thứ tự: position liền nhau, ảnh chính = ảnh đầu tiên khách thấy được");
check(
  "ảnh đầu là ảnh chính",
  normalizeImageOrder([
    { id: "a", needsReview: false },
    { id: "b", needsReview: false },
  ]),
  [
    { id: "a", position: 0, isPrimary: true },
    { id: "b", position: 1, isPrimary: false },
  ],
);
check(
  "ảnh chờ duyệt đứng đầu không làm ảnh chính — ảnh khách thấy kế tiếp lên thay",
  normalizeImageOrder([
    { id: "r", needsReview: true },
    { id: "a", needsReview: false },
  ]).map((entry) => [entry.id, entry.position, entry.isPrimary]),
  [
    ["r", 0, false],
    ["a", 1, true],
  ],
);
check("toàn ảnh chờ duyệt → không có ảnh chính", normalizeImageOrder([{ id: "r", needsReview: true }]), [{ id: "r", position: 0, isPrimary: false }]);
check("bộ ảnh rỗng", normalizeImageOrder([]), []);

console.log("\n[7] Đặt ảnh chính = đưa lên đầu");
check("giữ thứ tự tương đối các ảnh còn lại", moveToFront(["a", "b", "c", "d"], "c"), ["c", "a", "b", "d"]);
check("đã ở đầu thì không đổi", moveToFront(["a", "b"], "a"), ["a", "b"]);
check("id không có trong bộ ảnh thì không đổi", moveToFront(["a", "b"], "z"), ["a", "b"]);

console.log("\n[8] Đổi thứ tự: phải là hoán vị đúng của bộ ảnh hiện có");
check("hoán vị hợp lệ", checkReorder(["a", "b", "c"], ["c", "a", "b"]), null);
check("thiếu ảnh (người khác vừa thêm ảnh)", typeof checkReorder(["a", "b", "c"], ["a", "b"]), "string");
check("thừa ảnh lạ (ảnh đã bị xoá / của sản phẩm khác)", typeof checkReorder(["a", "b"], ["a", "b", "x"]), "string");
check("lặp một ảnh", typeof checkReorder(["a", "b"], ["a", "a"]), "string");

console.log("\n[9] File trên đĩa của một ảnh");
check(
  "ảnh crawler: đủ 3 cỡ thumb/medium/large",
  filesOfLocalPath("PCZ-MB-001/0123456789ab-medium.webp"),
  ["PCZ-MB-001/0123456789ab-thumb.webp", "PCZ-MB-001/0123456789ab-medium.webp", "PCZ-MB-001/0123456789ab-large.webp"],
);
check("ảnh tải lên: đúng một file", filesOfLocalPath("uploads/5f0c2a7e-1b2c-4d3e-8f90-a1b2c3d4e5f6.png"), [
  "uploads/5f0c2a7e-1b2c-4d3e-8f90-a1b2c3d4e5f6.png",
]);

console.log("\n[10] Không xoá nhầm file ngoài thư mục ảnh");
{
  const dir = resolve("/srv/pczone/images/products");
  check("đường dẫn hợp lệ bên trong", resolveInsideDir(dir, "uploads/a.png"), join(dir, "uploads", "a.png"));
  check("chặn ../", resolveInsideDir(dir, "../../../etc/passwd"), null);
  check("chặn ../ lẩn giữa đường dẫn", resolveInsideDir(dir, "uploads/../../banners/x.png"), null);
  check("chặn đường dẫn tuyệt đối", resolveInsideDir(dir, "/etc/passwd"), null);
  check("chặn chính thư mục gốc", resolveInsideDir(dir, "."), null);
  check("chặn chuỗi rỗng", resolveInsideDir(dir, ""), null);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
