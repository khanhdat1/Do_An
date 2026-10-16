/**
 * Kiểm thử bộ đọc định dạng câu trả lời AI Chat, không cần trình duyệt. Chạy: npm run test -w @pczone/web
 */
import { parseChatMarkdown, parseInline } from "./chat-markdown";

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

const text = (value: string) => ({ type: "text", text: value });

console.log("\n[1] parseInline");
{
  // Ca lỗi thật: giao diện in nguyên "**Lenovo LOQ Essential 15ARP10E**" kèm dấu sao
  check(
    "ca lỗi thật: **in đậm** thành nút strong, không còn dấu ** trong chữ",
    parseInline("Mình gợi ý **Lenovo LOQ Essential 15ARP10E** giá 26.990.000đ"),
    [text("Mình gợi ý "), { type: "strong", children: [text("Lenovo LOQ Essential 15ARP10E")] }, text(" giá 26.990.000đ")],
  );
  check("*nghiêng* và `mã`", parseInline("*rất* mát, socket `AM5`"), [{ type: "em", children: [text("rất")] }, text(" mát, socket "), { type: "code", text: "AM5" }]);
  check("đang stream dở, chưa đóng ** -> giữ nguyên chữ", parseInline("Mình gợi ý **Lenovo LOQ"), [text("Mình gợi ý **Lenovo LOQ")]);
  check("dấu * giữa hai dấu cách không phải in nghiêng", parseInline("RAM 8GB * 2 thanh"), [text("RAM 8GB * 2 thanh")]);
  check(
    "thẻ HTML trong câu trả lời chỉ là chữ (React tự escape, không có HTML thô)",
    parseInline("<img src=x onerror=alert(1)> **ok**"),
    [text("<img src=x onerror=alert(1)> "), { type: "strong", children: [text("ok")] }],
  );
}

console.log("\n[2] parseChatMarkdown");
{
  const blocks = parseChatMarkdown("Có 2 lựa chọn:\n\n- **ASUS TUF Gaming A15** — 24.490.000đ\n* Lenovo LOQ Essential 15ARP10E\n\nBạn cần thêm thông tin không?");
  check("gạch đầu dòng '- ' và '* ' gom thành một danh sách", blocks.map((block) => block.type), ["paragraph", "list", "paragraph"]);
  check(
    "mục danh sách giữ định dạng in đậm",
    blocks[1].type === "list" ? blocks[1].items[0] : null,
    [{ type: "strong", children: [text("ASUS TUF Gaming A15")] }, text(" — 24.490.000đ")],
  );

  const ordered = parseChatMarkdown("1. Ryzen 7 9700X\n2. Ryzen 7 9800X3D");
  check("danh sách đánh số", ordered.length === 1 && ordered[0].type === "list" ? [ordered[0].ordered, ordered[0].start, ordered[0].items.length] : null, [true, 1, 2]);

  check(
    "tiêu đề '### ' thành dòng in đậm, dòng liền nhau cùng một đoạn",
    parseChatMarkdown("### Gợi ý\nDòng hai"),
    [{ type: "paragraph", lines: [[{ type: "strong", children: [text("Gợi ý")] }], [text("Dòng hai")]] }],
  );
  check("dòng bắt đầu bằng **đậm** không bị nhầm là gạch đầu dòng", parseChatMarkdown("**Lưu ý:** giá có thể đổi")[0].type, "paragraph");
  check("chuỗi rỗng -> không có khối nào", parseChatMarkdown(""), []);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
