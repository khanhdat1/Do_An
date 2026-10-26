/**
 * Kiểm thử phần thuần của AI Chat (câu truy hồi, khoảng giá câu tiếp nối, thông số trong prompt) bằng dữ liệu giả,
 * không cần DB hay mạng. Chạy: npx tsx src/ai/chat-context.test.ts
 */
import { buildChatRetrievalQuery, buildChatSystemPrompt, shiftPriceFilter, summarizeSpecs } from "./chat-context.js";

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

const inRange = (price: number, filter: { min?: number; max?: number } | null) =>
  filter !== null && (filter.min === undefined || price >= filter.min) && (filter.max === undefined || price <= filter.max);

/** Giá thật trong DB dev của ASUS TUF Gaming A15 FA507NV — sản phẩm AI đã bỏ sót khi chấm */
const TUF_A15_PRICE = 24_490_000;

console.log("\n[1] buildChatRetrievalQuery — câu hỏi tiếp nối");
{
  const first = buildChatRetrievalQuery("laptop gaming tầm 25 triệu", []);
  check("câu đầu: cắt cụm giá khỏi câu truy hồi", first.text, "laptop gaming");
  check("câu đầu: lọc 20–30 triệu", [first.priceFilter?.min, first.priceFilter?.max], [20_000_000, 30_000_000]);

  // Ca lỗi thật khi chấm: trước đây chỉ nhúng đúng câu này, không có chữ nào về sản phẩm
  const followUp = buildChatRetrievalQuery("Còn con nào rẻ hơn chút không?", ["laptop gaming tầm 25 triệu"]);
  check("ca lỗi thật: 'Còn con nào rẻ hơn chút không?' được nhận là câu tiếp nối", followUp.isFollowUp, true);
  check("ca lỗi thật: câu truy hồi mang theo 'laptop gaming' của câu trước", followUp.text, "laptop gaming\nCòn con nào rẻ hơn chút không?");
  check("ca lỗi thật: 'rẻ hơn' so với 'tầm 25 triệu' -> lọc 20–25 triệu", [followUp.priceFilter?.min, followUp.priceFilter?.max], [20_000_000, 25_000_000]);
  check("ca lỗi thật: TUF A15 giá 24.490.000đ nằm trong khoảng lọc trước top-k", inRange(TUF_A15_PRICE, followUp.priceFilter), true);

  const again = buildChatRetrievalQuery("Còn con nào khác nữa không?", ["Còn con nào rẻ hơn chút không?", "laptop gaming tầm 25 triệu"]);
  check("câu tiếp nối thứ hai: vẫn giữ chủ đề và khoảng giá đã dịch", [again.text.startsWith("laptop gaming"), again.priceFilter?.max], [true, 25_000_000]);

  const cheaperAgain = buildChatRetrievalQuery("Rẻ hơn nữa được không?", ["Còn con nào rẻ hơn chút không?", "laptop gaming tầm 25 triệu"]);
  check("'rẻ hơn nữa' sau 20–25 triệu -> dưới 20 triệu", [cheaperAgain.priceFilter?.min, cheaperAgain.priceFilter?.max], [undefined, 20_000_000]);

  const pricier = buildChatRetrievalQuery("Có con nào xịn hơn, đắt hơn chút không?", ["laptop gaming tầm 25 triệu"]);
  check("'đắt hơn' so với 'tầm 25 triệu' -> lọc 25–30 triệu", [pricier.priceFilter?.min, pricier.priceFilter?.max], [25_000_000, 30_000_000]);

  const ownPrice = buildChatRetrievalQuery("Còn con nào dưới 22 triệu không?", ["laptop gaming tầm 25 triệu"]);
  check("câu tiếp nối có giá riêng -> dùng giá đó, vẫn mang chủ đề", [ownPrice.text.startsWith("laptop gaming"), ownPrice.priceFilter?.max], [true, 22_000_000]);

  const switched = buildChatRetrievalQuery("chuột gaming nào tốt?", ["laptop gaming tầm 25 triệu"]);
  check("đổi chủ đề: câu tự đủ nghĩa chỉ dùng chính nó", switched.text, "chuột gaming nào tốt?");
  check("đổi chủ đề: KHÔNG lọc chuột theo giá của câu hỏi laptop", switched.priceFilter, null);

  const reference = buildChatRetrievalQuery("Card đó dài bao nhiêu?", ["card RTX 5060 tầm 9 triệu"]);
  check("câu chỉ trỏ ('card đó') -> gộp với câu trước", reference.text, "card RTX 5060\nCard đó dài bao nhiêu?");
  check("câu chỉ trỏ có từ sản phẩm riêng, không nói tới giá -> không lọc giá", reference.priceFilter, null);

  const noAccents = buildChatRetrievalQuery("con con nao re hon khong", ["laptop gaming tam 25 trieu"]);
  check("gõ không dấu vẫn nhận ra câu tiếp nối 'rẻ hơn'", [noAccents.isFollowUp, noAccents.priceFilter?.max], [true, 25_000_000]);

  const storage = buildChatRetrievalQuery("ổ cứng nào tốt?", ["laptop gaming tầm 25 triệu"]);
  check("'ổ cứng' không bị coi là từ đệm ('cũng') -> chủ đề mới", [storage.isFollowUp, storage.text], [false, "ổ cứng nào tốt?"]);
}

console.log("\n[2] shiftPriceFilter");
{
  check("không có khoảng giá trước -> vẫn không lọc", shiftPriceFilter(null, "cheaper"), null);
  check("'dưới 30 triệu' rồi 'rẻ hơn' -> giữ dưới 30 triệu", shiftPriceFilter({ max: 30_000_000, label: "Dưới 30 triệu" }, "cheaper"), { max: 30_000_000, label: "Dưới 30 triệu" });
  check("'trên 20 triệu' rồi 'đắt hơn' -> giữ trên 20 triệu", shiftPriceFilter({ min: 20_000_000, label: "Trên 20 triệu" }, "pricier")?.min, 20_000_000);
}

console.log("\n[2b] Ngân sách là trần, không nới ±20% (H01: gợi ý mẫu 33 triệu cho 'ngân sách 30 triệu')");
{
  const budget = buildChatRetrievalQuery("Mình học đồ hoạ, ngân sách 30 triệu, nên chọn laptop nào?", []).priceFilter;
  check("'ngân sách 30 triệu' -> tối đa đúng 30 triệu", [budget?.max, budget?.budgetCeiling, budget?.label], [30_000_000, true, "Ngân sách tối đa 30 triệu"]);
  check("mẫu 32.990.000đ bị loại", inRange(32_990_000, budget), false);
  check("mẫu 29.990.000đ vẫn được gợi ý", inRange(29_990_000, budget), true);
  const noAccents = buildChatRetrievalQuery("ngan sach 30 trieu mua laptop do hoa", []).priceFilter;
  check("gõ không dấu cũng nhận ra", noAccents?.max, 30_000_000);
  const onlyHave = buildChatRetrievalQuery("mình chỉ có 20 triệu, mua laptop gì?", []).priceFilter;
  check("'chỉ có 20 triệu' -> tối đa 20 triệu", onlyHave?.max, 20_000_000);
  const around = buildChatRetrievalQuery("laptop gaming tầm 25 triệu", []).priceFilter;
  check("'tầm 25 triệu' vẫn là khoảng 20–30 triệu", [around?.min, around?.max, around?.budgetCeiling], [20_000_000, 30_000_000, undefined]);
  const pricier = buildChatRetrievalQuery("Có con nào đắt hơn không?", ["ngân sách 30 triệu mua laptop đồ hoạ"]).priceFilter;
  check("ngân sách rồi 'đắt hơn' -> trên 30 triệu", [pricier?.min, pricier?.max], [30_000_000, undefined]);
  const cheaper = buildChatRetrievalQuery("Có con nào rẻ hơn không?", ["ngân sách 30 triệu mua laptop đồ hoạ"]).priceFilter;
  check("ngân sách rồi 'rẻ hơn' -> dưới sàn 24 triệu", [cheaper?.min, cheaper?.max], [undefined, 24_000_000]);
}

console.log("\n[3] summarizeSpecs — thông số cho prompt");
{
  const vga = summarizeSpecs({
    keySpecs: [
      { label: "Bộ nhớ", value: "8 GB" },
      { label: "Chiều dài", value: "300 mm" },
      { label: "Điện năng (TDP)", value: "Chưa có dữ liệu" },
    ],
    highlights: ["RTX 5060 8GB GDDR7", "8 GB"],
    specifications: [{ label: "Nguồn đề xuất", value: "550W" }],
  });
  check("ca lỗi thật: chiều dài card (ProductSpec.gpuLengthMm) có trong prompt", vga.includes("Chiều dài: 300 mm"), true);
  check("bỏ dòng 'Chưa có dữ liệu' để AI không đọc lại như thông số thật", vga.includes("Chưa có dữ liệu"), false);
  check("đủ cả điểm nổi bật lẫn bảng thông số khi còn chỗ", vga, "Bộ nhớ: 8 GB; Chiều dài: 300 mm; RTX 5060 8GB GDDR7; 8 GB; Nguồn đề xuất: 550W");

  const long = summarizeSpecs({
    keySpecs: [],
    highlights: [],
    specifications: Array.from({ length: 40 }, (_, i) => ({ label: `Thông số ${i}`, value: "x".repeat(200) })),
  });
  check("giới hạn độ dài: không vượt 400 ký tự", long.length <= 400, true);
  check("giới hạn độ dài: mỗi giá trị bị cắt ngắn, vẫn giữ được vài mục", long.split("; ").length >= 2, true);
}

console.log("\n[4] buildChatSystemPrompt");
{
  const prompt = buildChatSystemPrompt(
    [{ name: "Card màn hình MSI RTX 5060 Ventus 2X", categoryName: "VGA", price: 8_490_000, inStock: true, specs: "Chiều dài: 197 mm" }],
    { min: 20_000_000, max: 25_000_000, label: "Từ 20 triệu đến 25 triệu" },
  );
  check("dòng sản phẩm kèm thông số", prompt.includes("- Card màn hình MSI RTX 5060 Ventus 2X (VGA) — 8.490.000đ — Còn hàng — Thông số: Chiều dài: 197 mm"), true);
  check("có luật cấm khẳng định giá sàn/giá trần của cả danh mục", prompt.includes("không khẳng định giá thấp nhất/cao nhất của cả một danh mục"), true);
  check("báo cho AI biết danh sách đã lọc theo khoảng giá", prompt.includes('lọc theo khoảng giá "Từ 20 triệu đến 25 triệu"'), true);
  check("có luật cấm nói tổng số sản phẩm PCZone có (H06: 'PCZone hiện có 3 lựa chọn' khi kho có 5 mainboard AM5)", prompt.includes("KHÔNG nói tổng số sản phẩm hay số lựa chọn mà PCZone có"), true);
  check("khoảng giá thường không kèm câu ngân sách", prompt.includes("ngân sách tối đa"), false);
  const budgetPrompt = buildChatSystemPrompt([], { min: 24_000_000, max: 30_000_000, target: 30_000_000, budgetCeiling: true, label: "Ngân sách tối đa 30 triệu" });
  check("có ngân sách -> dặn AI không gợi ý quá mức đó", budgetPrompt.includes("Khách đã nêu ngân sách tối đa 30.000.000đ: không gợi ý"), true);
  check("sản phẩm không có thông số -> không in phần 'Thông số:' rỗng", buildChatSystemPrompt([{ name: "A", categoryName: "B", price: 1000, inStock: false, specs: "" }], null).endsWith("- A (B) — 1.000đ — Hết hàng"), true);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
