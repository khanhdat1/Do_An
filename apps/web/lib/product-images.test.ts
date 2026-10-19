/**
 * Kiểm thử phần kiểm tra ảnh trước khi tải lên ở trang sửa sản phẩm, không cần trình duyệt. Chạy: npm run test -w @pczone/web
 */
import {
  addToSelection,
  fileKey,
  formatFileSize,
  moveItem,
  PRODUCT_IMAGE_MAX_BYTES,
  PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD,
  validateProductImageFile,
  type ImageFileLike,
} from "./product-images";

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

const file = (name: string, type = "image/png", size = 200 * 1024, lastModified = 1): ImageFileLike => ({ name, type, size, lastModified });
const names = (files: ImageFileLike[]) => files.map((f) => f.name);

console.log("\n[1] Kích thước tệp");
check("KB", formatFileSize(350 * 1024), "350 KB");
check("tệp rất nhỏ vẫn hiện 1 KB", formatFileSize(20), "1 KB");
check("MB dùng dấu phẩy thập phân", formatFileSize(1.25 * 1024 * 1024), "1,3 MB");

console.log("\n[2] Kiểm tra từng tệp");
check("PNG hợp lệ", validateProductImageFile(file("a.png")), null);
check("JPEG hợp lệ", validateProductImageFile(file("a.jpg", "image/jpeg")), null);
check("WEBP hợp lệ", validateProductImageFile(file("a.webp", "image/webp")), null);
check("PDF bị từ chối", validateProductImageFile(file("bao-gia.pdf", "application/pdf")), '"bao-gia.pdf" không phải ảnh JPEG, PNG hoặc WEBP');
check("GIF bị từ chối", validateProductImageFile(file("a.gif", "image/gif")), '"a.gif" không phải ảnh JPEG, PNG hoặc WEBP');
check("trình duyệt không nhận ra loại tệp (type rỗng)", validateProductImageFile(file("không-đuôi", "")), '"không-đuôi" không phải ảnh JPEG, PNG hoặc WEBP');
check("đúng 5 MB vẫn nhận", validateProductImageFile(file("a.png", "image/png", PRODUCT_IMAGE_MAX_BYTES)), null);
check(
  "quá 5 MB bị từ chối, nêu dung lượng thật",
  validateProductImageFile(file("lon.png", "image/png", 6 * 1024 * 1024)),
  '"lon.png" nặng 6,0 MB, vượt quá 5 MB',
);
check("tệp rỗng", validateProductImageFile(file("rong.png", "image/png", 0)), '"rong.png" là tệp rỗng');

console.log("\n[3] Gộp tệp vừa chọn vào danh sách chờ tải lên");
{
  const result = addToSelection([], [file("a.png"), file("b.pdf", "application/pdf"), file("c.jpg", "image/jpeg")], 0);
  check("giữ tệp hợp lệ theo đúng thứ tự chọn", names(result.accepted), ["a.png", "c.jpg"]);
  check("báo lỗi tệp sai loại", result.errors, ['"b.pdf" không phải ảnh JPEG, PNG hoặc WEBP']);
}
{
  const pending = [file("a.png")];
  const result = addToSelection(pending, [file("a.png"), file("a.png", "image/png", 200 * 1024, 2)], 0);
  check("cùng một tệp chọn lại thì bỏ qua", result.errors, ['"a.png" đã có trong danh sách chờ tải lên']);
  check("tệp cùng tên nhưng khác (sửa lúc khác) vẫn nhận", result.accepted.length, 1);
}
{
  const many = Array.from({ length: 12 }, (_, i) => file(`anh-${i + 1}.png`));
  const result = addToSelection([], many, 0);
  check("tối đa 10 ảnh mỗi lượt", result.accepted.length, PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD);
  check("báo số ảnh bị bỏ qua vì quá 10", result.errors, ["Mỗi lần tải lên tối đa 10 ảnh — đã bỏ qua 2 ảnh, tải nốt ở lượt sau"]);
}
{
  const result = addToSelection([file("x.png")], [file("a.png"), file("b.png"), file("c.png")], 17);
  check("sản phẩm đã 17 ảnh + 1 đang chờ → chỉ thêm được 2", names(result.accepted), ["a.png", "b.png"]);
  check("báo vượt trần 20 ảnh của sản phẩm", result.errors, ["Mỗi sản phẩm tối đa 20 ảnh — đã bỏ qua 1 ảnh vượt quá số này"]);
}
check("khoá tệp gồm tên, dung lượng, thời điểm sửa", fileKey(file("a.png", "image/png", 10, 99)), "a.png:10:99");

console.log("\n[4] Đổi chỗ phần tử");
check("chuyển ra sau", moveItem(["a", "b", "c", "d"], 0, 2), ["b", "c", "a", "d"]);
check("chuyển lên trước", moveItem(["a", "b", "c", "d"], 3, 1), ["a", "d", "b", "c"]);
check("ngoài phạm vi thì giữ nguyên", moveItem(["a", "b"], 1, 2), ["a", "b"]);
check("không làm thay đổi mảng gốc", (() => {
  const list = ["a", "b"];
  moveItem(list, 0, 1);
  return list;
})(), ["a", "b"]);

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
