// Kiểm thử phần AI gợi ý cấu hình không cần gọi AI/DB. Chạy: npx tsx src/ai/build-suggestion.test.ts
import type { BuildCheckResult } from "../pc-build/compatibility.js";
import {
  BUILD_PURPOSES,
  buildCatalog,
  buildRepairMessage,
  downgradeWeights,
  findRepairIssues,
  formatCatalog,
  parseSuggestion,
  minimumBuildTotal,
  statedBudget,
  suggestionName,
  type ParsedSuggestion,
} from "./build-suggestion.js";

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

const catalog = buildCatalog([
  { slot: "CPU", productId: "cpu-5500gt", name: "CPU AMD Ryzen 5 5500GT", price: 3_990_000, keySpecs: [{ label: "Socket", value: "AM4" }] },
  { slot: "CPU", productId: "cpu-8600g", name: "CPU AMD Ryzen 5 8600G", price: 6_990_000, keySpecs: [{ label: "Socket", value: "AM5" }] },
  { slot: "MAINBOARD", productId: "mb-b650m", name: "Bo mạch chủ B650M", price: 3_490_000, keySpecs: [{ label: "Socket", value: "AM5" }] },
  { slot: "RAM", productId: "ram-ddr5", name: "RAM DDR5 2x16GB", price: 3_000_000, keySpecs: [{ label: "Loại RAM", value: "DDR5" }] },
  { slot: "VGA", productId: "vga-5060", name: "Card RTX 5060", price: 8_490_000, keySpecs: [{ label: "Chiều dài", value: "199 mm" }] },
  { slot: "SSD", productId: "ssd-1tb", name: "SSD 1TB", price: 1_590_000, keySpecs: [] },
  { slot: "PSU", productId: "psu-650", name: "Nguồn 650W", price: 1_290_000, keySpecs: [{ label: "Công suất", value: "650 W" }] },
]);

console.log("\n[1] Danh sách ứng viên và mã ngắn");
{
  check("mã đánh riêng theo từng loại, theo thứ tự đầu vào", catalog.items.map((item) => item.code), ["C1", "C2", "M1", "R1", "V1", "S1", "P1"]);
  check("tra mã ra đúng sản phẩm", catalog.byCode.get("C2")?.productId, "cpu-8600g");
  const text = formatCatalog(catalog);
  check("mỗi dòng: mã | tên | giá | thông số", text.includes("C2 | CPU AMD Ryzen 5 8600G | 6.990.000đ | Socket: AM5"), true);
  check("loại không còn hàng vẫn có mục, ghi rõ hết hàng", text.includes("[CASE — Vỏ case]\n(hiện hết hàng)"), true);
}

const validReply = JSON.stringify({
  budget: 20_000_000,
  purpose: "Chơi game",
  picks: { CPU: "C2", MAINBOARD: "M1", RAM: "R1", VGA: "V1", SSD: "S1", PSU: "P1", CASE: null },
  ramQuantity: 1,
  summary: "  Cấu hình tầm trung cho chơi game.  ",
  notes: { CPU: "6 nhân, có đồ họa tích hợp.", VGA: "Card rời cho game.", CASE: "Không có vỏ nên câu này phải bị bỏ." },
});

console.log("\n[2] Đọc câu trả lời của AI");
{
  const parsed = parseSuggestion(validReply, catalog);
  check("mã -> id thật, đúng loại", parsed?.picks, {
    CPU: { productId: "cpu-8600g", quantity: 1 },
    MAINBOARD: { productId: "mb-b650m", quantity: 1 },
    RAM: { productId: "ram-ddr5", quantity: 1 },
    VGA: { productId: "vga-5060", quantity: 1 },
    SSD: { productId: "ssd-1tb", quantity: 1 },
    PSU: { productId: "psu-650", quantity: 1 },
  });
  check("ngân sách, nhu cầu, tóm tắt đã cắt khoảng trắng", [parsed?.budget, parsed?.purpose, parsed?.summary], [20_000_000, "Chơi game", "Cấu hình tầm trung cho chơi game."]);
  check("lý do chỉ giữ cho món thật sự được chọn", Object.keys(parsed?.notes ?? {}), ["CPU", "VGA"]);
  check("null không tính là mã sai", parsed?.rejectedCodes, []);

  check("chịu được khối ```json và chữ thừa", parseSuggestion(`Đây là cấu hình:\n\`\`\`json\n${validReply}\n\`\`\`\nChúc bạn vui!`, catalog)?.picks.CPU, { productId: "cpu-8600g", quantity: 1 });
  check("không phải JSON -> null", parseSuggestion("Xin lỗi, tôi không thể giúp.", catalog), null);

  const tricky = parseSuggestion(
    JSON.stringify({ picks: { cpu: "c1", MAINBOARD: "C2", RAM: "R1 - RAM DDR5", VGA: "V99", SSD: { code: "S1" }, GPU: "V1" }, ramQuantity: 9, budget: "25.000.000", purpose: "chơi GAME" }),
    catalog,
  );
  check("khoá/mã viết thường, mã kèm tên, mã dạng object vẫn đọc được", [tricky?.picks.CPU?.productId, tricky?.picks.RAM?.productId, tricky?.picks.SSD?.productId], ["cpu-5500gt", "ram-ddr5", "ssd-1tb"]);
  check("mã không có trong kho hoặc sai loại bị bỏ (không có sản phẩm bịa)", [tricky?.picks.MAINBOARD, tricky?.picks.VGA, tricky?.rejectedCodes], [undefined, undefined, ["C2", "V99"]]);
  check("khoá lạ (GPU) bị bỏ qua", Object.keys(tricky?.picks ?? {}).includes("GPU"), false);
  check("số lượng RAM vượt 4 -> 4", tricky?.picks.RAM?.quantity, 4);
  check("ngân sách dạng chuỗi có dấu chấm", tricky?.budget, 25_000_000);
  check("nhu cầu so không phân biệt hoa thường", tricky?.purpose, "Chơi game");

  const odd = parseSuggestion(JSON.stringify({ picks: { RAM: "R1" }, ramQuantity: 0, budget: 500, purpose: "đào coin" }), catalog);
  check("số lượng RAM < 1 -> 1", odd?.picks.RAM?.quantity, 1);
  check("ngân sách vô lý -> null", odd?.budget, null);
  check("nhu cầu ngoài danh sách -> Đa dụng", odd?.purpose, "Đa dụng");

  const purposeOf = (purpose: string) => parseSuggestion(JSON.stringify({ purpose }), catalog)?.purpose;
  check("AI ghép nhiều nhu cầu -> lấy mục đầu tiên khớp", purposeOf("Chơi game, dựng video"), "Chơi game");
  check("'gaming' -> Chơi game", purposeOf("gaming"), "Chơi game");
  check("'code và học AI' -> Lập trình - AI", purposeOf("code và học AI"), "Lập trình - AI");
  check("'làm văn phòng' -> Văn phòng - học tập", purposeOf("làm văn phòng"), "Văn phòng - học tập");
  check("chữ 'ai' nằm trong từ khác không bị tính", purposeOf("đồ gia dụng"), "Đa dụng");
}

function result(overrides: Partial<BuildCheckResult>): BuildCheckResult {
  return {
    checks: [],
    power: { cpuW: 65, gpuW: 0, baseW: 80, estimatedW: 145, recommendedPsuW: 189 },
    totalPrice: 18_000_000,
    missingSlots: [],
    isComplete: true,
    isValid: true,
    status: "COMPATIBLE",
    ...overrides,
  };
}

function suggestion(overrides: Partial<ParsedSuggestion>): ParsedSuggestion {
  return {
    picks: { CPU: { productId: "cpu-8600g", quantity: 1 }, VGA: { productId: "vga-5060", quantity: 1 } },
    budget: 20_000_000,
    purpose: "Chơi game",
    summary: "",
    notes: {},
    rejectedCodes: [],
    ...overrides,
  };
}

const issuesOf = (picked: Partial<ParsedSuggestion>, checked: Partial<BuildCheckResult>) => findRepairIssues(suggestion(picked), result(checked), catalog);

console.log("\n[3] Khi nào phải nhờ AI sửa");
{
  check("cấu hình ổn, trong ngân sách -> không sửa", issuesOf({}, {}), []);
  check(
    "chỉ có cảnh báo thiếu dữ liệu -> không sửa",
    issuesOf({}, { checks: [{ rule: "VGA_LENGTH", severity: "WARNING", message: "Chưa có thông số…", productIds: [], insufficientData: true }], status: "NEEDS_REVIEW" }),
    [],
  );
  check(
    "lỗi tương thích -> gửi đúng thông báo của bộ kiểm tra",
    issuesOf({}, { checks: [{ rule: "CPU_SOCKET", severity: "ERROR", message: "CPU dùng socket AM5 nhưng mainboard dùng socket LGA1700 — không lắp được.", productIds: [] }] }),
    ["CPU dùng socket AM5 nhưng mainboard dùng socket LGA1700 — không lắp được."],
  );
  check("thiếu linh kiện bắt buộc", issuesOf({}, { missingSlots: ["PSU", "CASE"] }), ["Còn thiếu linh kiện bắt buộc: PSU (Nguồn), CASE (Vỏ case)."]);
  check("vượt ngân sách: nêu số tiền vượt và giá từng món, giá cao trước", issuesOf({}, { totalPrice: 21_500_000 }), [
    "Tổng giá 21.500.000đ vượt ngân sách 20.000.000đ khoảng 1.500.000đ. Giá từng món đang chọn: VGA: Card RTX 5060 (8.490.000đ); CPU: CPU AMD Ryzen 5 8600G (6.990.000đ). Hãy đổi 1–2 món sang món rẻ hơn gần nhất (không nhảy xuống món rẻ nhất) vừa đủ để tổng không vượt ngân sách. Với nhu cầu này, giữ card đồ họa mạnh nhất có thể (tối đa hạ một bậc) và cắt bớt ở SSD, RAM, vỏ case, nguồn trước.",
  ]);
  check("không nêu ngân sách thì không tính vượt", issuesOf({ budget: null }, { totalPrice: 99_000_000 }), []);
  check("chơi game mà dùng dưới 70% ngân sách -> nhờ nâng cấp", issuesOf({}, { totalPrice: 12_000_000 })[0]?.startsWith("Tổng giá 12.000.000đ mới dùng khoảng 60% ngân sách"), true);
  check("văn phòng dùng ít ngân sách thì không sao", issuesOf({ purpose: "Văn phòng - học tập" }, { totalPrice: 8_000_000 }), []);
  check("chơi game mà không có card rời", issuesOf({ picks: {} }, {}), ['Nhu cầu "Chơi game" cần card đồ họa rời (VGA) nhưng cấu hình chưa có.']);
  check("văn phòng không có card rời thì được", issuesOf({ picks: {}, purpose: "Văn phòng - học tập" }, {}), []);
  check("mã bịa bị bỏ -> báo lại cho AI", issuesOf({ rejectedCodes: ["V99"] }, {}), ["Các mã sau không có trong kho hoặc đặt sai loại nên đã bị bỏ: V99."]);
  check("tin nhắn sửa liệt kê từng vấn đề", buildRepairMessage(["A", "B"]).includes("- A\n- B"), true);
}

console.log("\n[4] Chặn sớm ngân sách chắc chắn không đủ (không tốn lượt gọi AI)");
{
  check("'khoảng 5 triệu' -> lấy mức cao 6 triệu, giữ nhãn lời khách", statedBudget("PC 5 triệu chơi game"), { amount: 6_000_000, label: "Khoảng 5 triệu" });
  check("'dưới 8 triệu' -> 8 triệu", statedBudget("build pc dưới 8tr để học"), { amount: 8_000_000, label: "Dưới 8 triệu" });
  check("không nêu ngân sách -> null", statedBudget("PC chơi game đẹp"), null);
  check(
    "bộ rẻ nhất = món rẻ nhất mỗi loại bắt buộc, không tính card rời",
    minimumBuildTotal([
      ...catalog.items,
      { slot: "CASE", productId: "case-1", name: "Vỏ", price: 1_090_000, keySpecs: [] },
    ]),
    3_990_000 + 3_490_000 + 3_000_000 + 1_590_000 + 1_290_000 + 1_090_000,
  );
  check("thiếu hẳn một loại bắt buộc -> không kết luận", minimumBuildTotal(catalog.items), null);
}

console.log("\n[5] Tên cấu hình");
{
  check("có ngân sách", suggestionName("Chơi game", 20_000_000), "Gợi ý AI · Chơi game · 20 triệu");
  check("không nêu ngân sách", suggestionName("Đa dụng", null), "Gợi ý AI · Đa dụng");
}

console.log("\n[6] Thứ tự giữ lại khi hệ thống tự hạ cấp cho vừa ngân sách");
{
  const mostKept = (purpose: (typeof BUILD_PURPOSES)[number]) =>
    Object.entries(downgradeWeights(purpose)).sort(([, a], [, b]) => b - a)[0][0];
  check("chơi game: card đồ họa được giữ lâu nhất", mostKept("Chơi game"), "VGA");
  check("văn phòng: CPU được giữ lâu hơn card rời", downgradeWeights("Văn phòng - học tập").CPU > downgradeWeights("Văn phòng - học tập").VGA, true);
  check(
    "mọi nhu cầu đủ 7 loại, trọng số dương, vỏ case luôn cắt trước",
    BUILD_PURPOSES.every((purpose) => {
      const weights = Object.values(downgradeWeights(purpose));
      return weights.length === 7 && weights.every((weight) => weight > 0) && Math.min(...weights) === downgradeWeights(purpose).CASE;
    }),
    true,
  );
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
