/**
 * Kiểm thử phần giữ bộ lọc trang danh mục trên URL (thêm bộ lọc thông số kỹ thuật), không cần trình duyệt.
 * Chạy: npm run test -w @pczone/web
 */
import {
  countActiveFilters,
  FILTER_PARAMS,
  isSpecFilterKey,
  orderSpecOptions,
  parseCategoryQuery,
  parseSpecSelections,
  specQueryParams,
  toggleSpecValue,
  toSearchParams,
} from "./category-query";

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

console.log("\n[1] Đọc bộ lọc thông số từ URL");
{
  check("nhiều giá trị cách dấu phẩy, bỏ trùng và khoảng trắng", parseSpecSelections({ socket: "AM5, LGA1851,,AM5" }), {
    socket: ["AM5", "LGA1851"],
  });
  check("nhiều nhóm cùng lúc", parseSpecSelections({ cpuBrand: "amd", ram: "16,32", gpu: "rtx-4070-ti-super" }), {
    ram: ["16", "32"],
    cpuBrand: ["amd"],
    gpu: ["rtx-4070-ti-super"],
  });
  check(
    "giá trị API không nhận (ký tự lạ, quá 24 ký tự) bị bỏ — API không phải báo lỗi",
    parseSpecSelections({ socket: "AM5,<script>,a b,x".concat("y".repeat(30)) }),
    { socket: ["AM5"] },
  );
  check(
    "tối đa 12 giá trị một nhóm",
    parseSpecSelections({ ram: Array.from({ length: 20 }, (_, index) => String(index + 1)).join(",") }).ram?.length,
    12,
  );
  check("tham số không phải bộ lọc thông số bị bỏ qua", parseSpecSelections({ q: "laptop", brand: "asus" }), {});
  check("tham số lặp lại lấy giá trị đầu", parseSpecSelections({ ramType: ["DDR5", "DDR4"] }), { ramType: ["DDR5"] });
  check("parseCategoryQuery có thêm specs", parseCategoryQuery({ brand: "asus", socket: "AM5" }).specs, { socket: ["AM5"] });
}

console.log("\n[2] Dựng lại URL và tham số gửi API");
{
  const query = parseCategoryQuery({ brand: "asus", ramType: "DDR5", socket: "AM5,AM4", sort: "price-asc", page: "3" });
  check(
    "toSearchParams giữ bộ lọc thông số (cho liên kết phân trang), không giữ trang",
    toSearchParams(query).toString(),
    "brand=asus&socket=AM5%2CAM4&ramType=DDR5&sort=price-asc",
  );
  check("tham số API", specQueryParams({ socket: ["AM5", "AM4"], ram: [], vram: ["16"] }), { socket: "AM5,AM4", vram: "16" });
  check("đọc lại đúng như cũ", parseCategoryQuery(Object.fromEntries(toSearchParams(query))).specs, query.specs);
  check("Xóa lọc xoá cả tham số thông số", ["socket", "cpuLine", "gpu", "brand"].every((key) => (FILTER_PARAMS as readonly string[]).includes(key)), true);
  check("isSpecFilterKey", [isSpecFilterKey("cpuLine"), isSpecFilterKey("brand"), isSpecFilterKey("constructor")], [true, false, false]);
}

console.log("\n[3] Bật/tắt và đếm");
{
  check("bật thêm giá trị, giữ thứ tự đã chọn", toggleSpecValue(["AM5"], "AM4"), ["AM5", "AM4"]);
  check("bấm lại thì bỏ chọn", toggleSpecValue(["AM5", "AM4"], "AM5"), ["AM4"]);
  check("nhóm chưa chọn gì", toggleSpecValue(undefined, "DDR5"), ["DDR5"]);
  check(
    "mỗi giá trị thông số tính là một bộ lọc",
    countActiveFilters({ brands: ["asus"], inStock: true, minPrice: 1, specs: { socket: ["AM5", "AM4"], ramType: ["DDR5"] } }),
    6,
  );
  check("trang tìm kiếm (không có specs) đếm như cũ", countActiveFilters({ brands: ["asus", "msi"], inStock: false }), 2);
}

console.log("\n[4] Thứ tự lựa chọn trong một nhóm");
{
  const options = [
    { value: "core-i5", count: 0 },
    { value: "core-i7", count: 0 },
    { value: "ryzen-5", count: 5 },
    { value: "core-ultra-7", count: 0 },
    { value: "ryzen-7", count: 13 },
  ];
  check(
    "còn sản phẩm lên trước, về 0 xuống cuối, giữ thứ tự trong mỗi phần",
    orderSpecOptions(options, []).map((option) => option.value),
    ["ryzen-5", "ryzen-7", "core-i5", "core-i7", "core-ultra-7"],
  );
  check(
    "giá trị đang chọn dù về 0 vẫn ở phần trên, để bỏ chọn được",
    orderSpecOptions(options, ["core-i7"]).map((option) => option.value),
    ["core-i7", "ryzen-5", "ryzen-7", "core-i5", "core-ultra-7"],
  );
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
