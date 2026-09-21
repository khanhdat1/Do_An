/**
 * Mô tả sản phẩm là văn bản thuần kèm vài quy ước nhẹ (không phải HTML hay Markdown
 * đầy đủ, nên không có chỗ nào để chèn mã lạ vào trang):
 *
 *   # Tiêu đề              tiêu đề chính của bài mô tả (tên + thông số nổi bật)
 *   ## Tiêu đề mục         tiêu đề của một mục
 *   - Ý ngắn               gạch đầu dòng; các dòng liền nhau gộp thành một danh sách
 *   [ảnh 2]               chèn ảnh thứ 2 của thư viện ảnh sản phẩm
 *   [ảnh 2: Chú thích]    như trên, kèm chú thích riêng (mặc định: "PCZone - tên sản phẩm")
 *   (dòng trống)          ngăn cách các đoạn
 *
 * Mô tả cũ dạng chữ thuần (crawler, nhập tay) không dùng quy ước nào vẫn hiển thị bình thường.
 */
export type DescriptionBlock =
  | { type: "title"; text: string }
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  /** `index` tính từ 0; ảnh không tồn tại thì nơi hiển thị bỏ qua khối này */
  | { type: "image"; index: number; caption?: string };

const HEADING_LINE = /^(#{1,2})\s+(.+)$/;
const IMAGE_LINE = /^\[ảnh\s+(\d+)(?:\s*:\s*(.+?))?\s*\]$/i;
const BULLET_LINE = /^[-•]\s+(.+)$/;

export function parseDescription(text: string): DescriptionBlock[] {
  const blocks: DescriptionBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length > 0) blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };
  const flushList = () => {
    if (list.length > 0) blocks.push({ type: "list", items: list });
    list = [];
  };

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = HEADING_LINE.exec(line);
    if (heading) {
      flushParagraph();
      flushList();
      blocks.push({ type: heading[1].length === 1 ? "title" : "heading", text: heading[2].trim() });
      continue;
    }

    const image = IMAGE_LINE.exec(line);
    if (image) {
      flushParagraph();
      flushList();
      blocks.push({ type: "image", index: Number(image[1]) - 1, caption: image[2]?.trim() });
      continue;
    }

    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1].trim());
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks;
}
