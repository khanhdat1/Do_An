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

// Catalog PC lắp ráp thật đặt tên kiểu này — "PC Gaming PCZone" lặp lại ở MỌI ứng viên, không phân
// biệt được sản phẩm nào. Đây là ca lỗi thật gặp khi test: một câu trả lời "chưa có hàng" (không nhắc
// tên sản phẩm nào) vẫn bị trích dẫn nhầm 8 sản phẩm chỉ vì khớp "pc"/"gaming"/"pczone" chung chung.
const pcCandidates = [
  { productId: "prod-pc-i5-3050", name: "PC Gaming PCZone i5-12400F RTX 3050" },
  { productId: "prod-pc-i7-5060", name: "PC Gaming PCZone i7-14700F RTX 5060" },
  { productId: "prod-pc-i5-5060", name: "PC Gaming PCZone i5-12400F RTX 5060" },
  { productId: "prod-pc-i3-6500xt", name: "PC Gaming PCZone i3-12100F RX 6500 XT" },
  { productId: "prod-pc-i5-5060ti", name: "PC Gaming PCZone i5-12400F RTX 5060 Ti" },
];

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

  check(
    "ca lỗi thật: trả lời 'chưa có hàng' không nhắc sản phẩm nào -> KHÔNG được trích dẫn dù nhiều ứng viên cùng chứa 'PC'/'Gaming'/'PCZone'",
    findCitedProductIds("Chào bạn, hiện tại PCZone chưa có sản phẩm loa chuyên dụng cho phòng gaming. Bạn cần tư vấn thêm về PC hay chuột gaming không?", pcCandidates),
    [],
  );

  check(
    // Trước đây bản RTX 5060 thường bị trích kèm vì "5060" là chuỗi con của "5060ti" sau compact().
    // Mã model giờ so NGUYÊN TỪ nên "5060 Ti" không còn bị coi là nhắc tới bản "5060".
    "cùng bộ ứng viên 'PC Gaming PCZone' ở trên, nhưng trả lời THẬT SỰ nêu tên một sản phẩm -> trích dẫn đúng sản phẩm đó, không kèm bản 5060 thường",
    findCitedProductIds("Mình gợi ý cấu hình i5-12400F RTX 5060 Ti, đủ mạnh cho nhu cầu của bạn.", pcCandidates),
    ["prod-pc-i5-5060ti"],
  );
}

// Tên đúng như trong DB dev (apps/crawler/data/demo-catalog.json qua displayName(), và seed.ts)
const loqEssential = { productId: "prod-loq-essential", name: "Laptop gaming Lenovo LOQ Essential 15ARP10E 83S0000DVN" };
const loq15irx10 = { productId: "prod-loq-15irx10", name: "Laptop gaming Lenovo LOQ 15IRX10 83JE01AGVN" };
const loq15arp10e = { productId: "prod-loq-15arp10e", name: "Laptop gaming Lenovo LOQ 15ARP10E 83S0006RVN" };
const laptopCandidates = [
  loqEssential,
  loq15irx10,
  loq15arp10e,
  { productId: "prod-tuf-fa506", name: "Laptop gaming ASUS TUF Gaming A15 FA506NCG-HN329W" },
  { productId: "prod-tuf-fa507", name: "Laptop ASUS TUF Gaming A15 FA507NV" },
  { productId: "prod-tuf-f16", name: "Laptop gaming ASUS TUF Gaming F16 FX608JHI-TU209W" },
  { productId: "prod-rog-g16", name: "Laptop ASUS ROG Strix G16 G614JIR" },
];

const cpuCandidates = [
  { productId: "prod-9700x", name: "CPU AMD Ryzen 7 9700X AM5 Zen 5" },
  { productId: "prod-9800x3d", name: "CPU AMD Ryzen 7 9800X3D" },
  { productId: "prod-265k", name: "CPU Intel Core Ultra 7 265K" },
  { productId: "prod-4070tis", name: "Card màn hình ASUS TUF RTX 4070 Ti SUPER" },
  { productId: "prod-4080s", name: "GIGABYTE RTX 4080 SUPER Gaming OC 16GB" },
  { productId: "prod-ram", name: "RAM Corsair Vengeance RGB DDR5 32GB 6000MHz" },
];

console.log("\n[2] findCitedProductIds — bắt buộc khớp mã model (ca lỗi thật khi chấm)");
{
  check(
    "ca lỗi thật: nhắc 'Lenovo LOQ Essential 15ARP10E' -> KHÔNG trích kèm 'LOQ 15IRX10 83JE01AGVN' (chỉ chung hãng/dòng), cũng không kèm bản 'LOQ 15ARP10E' thường",
    findCitedProductIds(
      "Trong tầm giá này, mình gợi ý **Lenovo LOQ Essential 15ARP10E** giá 26.990.000đ, còn hàng, chip Ryzen 5 7535HS cùng RTX 3050 6GB, đủ chơi tốt các game eSports.",
      laptopCandidates,
    ),
    ["prod-loq-essential"],
  );

  check(
    "nhắc hai mẫu LOQ bằng đúng mã model -> trích cả hai",
    findCitedProductIds("Bạn có thể cân nhắc Lenovo LOQ Essential 15ARP10E hoặc mạnh hơn là Lenovo LOQ 15IRX10.", laptopCandidates),
    ["prod-loq-essential", "prod-loq-15irx10"],
  );

  check(
    "nhắc 'TUF Gaming A15 FA506NCG' -> không trích kèm 'TUF Gaming A15 FA507NV' dù chung dòng A15",
    findCitedProductIds("Con ASUS TUF Gaming A15 FA506NCG là lựa chọn bền bỉ, giá dễ chịu.", laptopCandidates),
    ["prod-tuf-fa506"],
  );

  check(
    "ca lỗi thật: nhắc 'Ryzen 7 9700X' -> KHÔNG trích kèm 'Ryzen 7 9800X3D'",
    findCitedProductIds("Với nhu cầu chơi game, bạn có thể chọn **AMD Ryzen 7 9700X** (8 nhân 16 luồng, socket AM5, TDP 65W).", cpuCandidates),
    ["prod-9700x"],
  );

  check(
    "chiều ngược lại: nhắc 'Ryzen 7 9800X3D' -> không trích kèm 9700X",
    findCitedProductIds("Nếu chỉ chơi game thì AMD Ryzen 7 9800X3D là CPU gaming mạnh nhất trong danh sách.", cpuCandidates),
    ["prod-9800x3d"],
  );

  check(
    "mã so nguyên từ: nhắc '9950X3D' -> không trích bản '9950X' (dù '9950x' là chuỗi con của '9950x3d')",
    findCitedProductIds("Ryzen 9 9950X3D là lựa chọn mạnh nhất cho vừa chơi game vừa render.", [
      { productId: "prod-9950x", name: "CPU AMD Ryzen 9 9950X" },
      { productId: "prod-9950x3d", name: "CPU AMD Ryzen 9 9950X3D" },
    ]),
    ["prod-9950x3d"],
  );

  check(
    "viết liền/viết rời khác tên trong DB ('RTX4070 Ti Super' so với 'RTX 4070 Ti SUPER') -> vẫn khớp mã",
    findCitedProductIds("Card ASUS TUF RTX4070 Ti Super chạy 2K rất ổn.", cpuCandidates),
    ["prod-4070tis"],
  );
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
