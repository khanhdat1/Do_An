/**
 * Kiểm thử xác định trích dẫn sản phẩm bằng dữ liệu giả, không cần DB hay mạng. Chạy: npx tsx src/ai/citation.test.ts
 */
import { findCitedProductIds } from "./citation.js";

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

const rogStrix = {
  productId: "prod-rog-strix",
  name: "Laptop Gaming Asus ROG Strix G16 G614JV-N3200W (Intel Core i7-13650HX, RAM 16GB, 512GB SSD, RTX4060 8GB, 16 inch 165Hz, Win 11)",
};
const ideapad = {
  productId: "prod-ideapad",
  name: "Laptop Lenovo IdeaPad Slim 3 14IWC11 83RQ00DBVN",
};
const mouse = {
  productId: "prod-mouse",
  name: "Chuột Logitech G102 Lightsync",
};

console.log("\n[1] findCitedProductIds");
{
  check(
    "nhắc nguyên văn tên đầy đủ -> được trích dẫn",
    findCitedProductIds(
      "Mình gợi ý con Laptop Gaming Asus ROG Strix G16 G614JV-N3200W (Intel Core i7-13650HX, RAM 16GB, 512GB SSD, RTX4060 8GB, 16 inch 165Hz, Win 11), rất mạnh cho việc chơi game.",
      [rogStrix],
    ),
    ["prod-rog-strix"],
  );

  check(
    "chỉ diễn đạt lại ngắn gọn (không lặp nguyên tên dài) -> vẫn được trích dẫn nhờ so theo tỉ lệ token",
    findCitedProductIds("Con ROG Strix G16 dùng RTX4060 rất phù hợp với nhu cầu chơi game của bạn.", [rogStrix]),
    ["prod-rog-strix"],
  );

  check(
    "cách nhau dấu cách khác với DB (RTX 4060 so với RTX4060) -> vẫn khớp",
    findCitedProductIds("Máy này dùng card đồ hoạ RTX 4060, chip Intel Core i7-13650HX, 16 inch, Asus ROG Strix.", [rogStrix]),
    ["prod-rog-strix"],
  );

  check(
    "bỏ dấu tiếng Việt trong câu trả lời không ảnh hưởng (tên gốc vốn đã là tiếng Anh/số)",
    findCitedProductIds("Laptop Asus ROG Strix G16 RTX4060 la lua chon tot cho game thu.", [rogStrix]),
    ["prod-rog-strix"],
  );

  check(
    "sản phẩm không liên quan tới câu trả lời -> không được trích dẫn",
    findCitedProductIds("Mình gợi ý con ROG Strix G16 RTX4060 phù hợp với nhu cầu chơi game của bạn.", [mouse]),
    [],
  );

  check("câu trả lời rỗng -> không có gì được trích dẫn", findCitedProductIds("", [rogStrix, ideapad, mouse]), []);

  check(
    "chỉ tên ngắn, không đủ token đặc trưng -> không khớp nhầm sản phẩm khác chỉ vì có từ chung",
    findCitedProductIds("Đây là một chiếc laptop tốt.", [ideapad]),
    [],
  );

  check(
    "trả lời nhắc nhiều sản phẩm, giữ đúng thứ tự đầu vào (không phải thứ tự xuất hiện trong câu trả lời)",
    findCitedProductIds("So sánh giữa IdeaPad Slim 3 14IWC và ROG Strix G16 RTX4060 thì tuỳ nhu cầu của bạn.", [rogStrix, ideapad, mouse]),
    ["prod-rog-strix", "prod-ideapad"],
  );
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
