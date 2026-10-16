/**
 * Kiểm thử dựng văn bản chỉ mục AI (`Product.aiSearchText`) bằng dữ liệu giả, không cần DB hay mạng.
 * Chạy: npx tsx src/ai/search-text.test.ts
 */
import { AI_SEARCH_TEXT_MAX_LENGTH, buildAiSearchText } from "./search-text.js";

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

console.log("\n[1] buildAiSearchText");
{
  // Ca lỗi thật: sản phẩm admin thêm tay trước đây để aiSearchText = null nên embedding-store bỏ qua hẳn
  check(
    "sản phẩm admin thêm tay: đủ tên + hãng + danh mục + mô tả ngắn + thông số, cùng khuôn với crawler",
    buildAiSearchText({
      name: "Card màn hình MSI RTX 5060 Ventus 2X OC 8G",
      brandName: "MSI",
      categoryName: "VGA - Card màn hình",
      shortDescription: "Card RTX 5060 nhỏ gọn cho case mini",
      specifications: [
        { label: "Bộ nhớ", value: "8GB GDDR7" },
        { label: "Kích thước", value: "197 x 120 x 42 mm" },
      ],
    }),
    "Card màn hình MSI RTX 5060 Ventus 2X OC 8G\nThương hiệu: MSI\nDanh mục: VGA - Card màn hình\nCard RTX 5060 nhỏ gọn cho case mini\nBộ nhớ: 8GB GDDR7\nKích thước: 197 x 120 x 42 mm",
  );

  check(
    "không có hãng/mô tả/thông số -> chỉ tên + danh mục, không có dòng rỗng hay 'Thương hiệu: '",
    buildAiSearchText({ name: "Lót chuột PCZone", brandName: null, categoryName: "Lót chuột", shortDescription: "  " }),
    "Lót chuột PCZone\nDanh mục: Lót chuột",
  );

  check(
    "giữ shortSpecs (sửa sản phẩm do crawler tạo không làm mất điểm nổi bật trong chỉ mục)",
    buildAiSearchText({ name: "SSD A", categoryName: "SSD", shortSpecs: ["1TB", " NVMe PCIe 4.0 "], specifications: [{ label: "Chuẩn", value: " " }] }),
    "SSD A\nDanh mục: SSD\n1TB\nNVMe PCIe 4.0",
  );

  check(
    "giới hạn độ dài như crawler",
    buildAiSearchText({ name: "X", specifications: [{ label: "Mô tả", value: "y".repeat(50_000) }] }).length,
    AI_SEARCH_TEXT_MAX_LENGTH,
  );
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
