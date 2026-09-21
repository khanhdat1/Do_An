/**
 * Từ đồng nghĩa khi tìm kiếm: người mua gõ "mouse", "vga", "headphone", "monitor" trong khi tên sản phẩm ghi
 * "Chuột", "Card màn hình", "Tai nghe", "Màn hình". Mỗi nhóm là các cách gọi của cùng một thứ (đã chuẩn hoá, không
 * dấu). Một từ khoá khớp nếu chính nó HOẶC bất kỳ cách gọi nào khác trong nhóm xuất hiện trong sản phẩm.
 *
 * Chỉ các cách gọi MỘT từ mới đóng vai từ khoá được mở rộng (câu người dùng đã bị tách từng từ); cách gọi nhiều từ
 * ("card man hinh") đóng vai vế được thử thêm, và được so như một cụm liền.
 */
const GROUPS: string[][] = [
  ["laptop", "may tinh xach tay", "notebook"],
  ["vga", "card man hinh", "card do hoa", "gpu"],
  ["cpu", "vi xu ly", "processor"],
  ["ssd", "o cung"],
  ["mainboard", "bo mach chu", "mobo"],
  ["psu", "nguon may tinh", "nguon"],
  ["case", "vo case", "thung may"],
  ["monitor", "man hinh", "display"],
  ["mouse", "chuot"],
  ["keyboard", "ban phim"],
  ["headphone", "headphones", "headset", "earphone", "earphones", "tai nghe"],
  ["speaker", "speakers", "loa"],
  ["chair", "ghe"],
  ["desk", "ban nang ha", "ban gaming"],
  ["gaming", "game", "gamer"],
  ["wifi", "wi fi"],
  ["typec", "type c"],
  ["usbc", "usb c"],
];

const TABLE = new Map<string, string[]>();
for (const group of GROUPS) {
  for (const member of group) {
    if (member.includes(" ")) continue;
    TABLE.set(member, [...new Set([...(TABLE.get(member) ?? []), ...group.filter((other) => other !== member)])]);
  }
}

/** Các cách gọi khác của một từ khoá (rỗng nếu không có) */
export function synonymsOf(term: string): string[] {
  return TABLE.get(term) ?? [];
}
