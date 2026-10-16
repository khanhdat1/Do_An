/**
 * Đọc vài định dạng đơn giản mà model hay dùng trong câu trả lời AI Chat (**in đậm**, *nghiêng*, `mã`, gạch đầu
 * dòng, danh sách đánh số, tiêu đề #) thành cây dữ liệu để React tự dựng phần tử — KHÔNG sinh HTML, không dùng
 * dangerouslySetInnerHTML, nên nội dung model trả về (kể cả có "<script>") luôn chỉ là chữ.
 *
 * Cố ý chỉ hỗ trợ chừng đó: system prompt dặn model chỉ dùng in đậm và gạch đầu dòng. Cú pháp khác (bảng, link,
 * ảnh...) giữ nguyên chữ. Chưa đóng cặp dấu (đang stream dở "**Lenovo") thì hiện nguyên văn tới khi đóng.
 */

export type InlineNode =
  | { type: "text"; text: string }
  | { type: "strong"; children: InlineNode[] }
  | { type: "em"; children: InlineNode[] }
  | { type: "code"; text: string };

export type ChatBlock =
  | { type: "paragraph"; lines: InlineNode[][] }
  | { type: "list"; ordered: boolean; start: number; items: InlineNode[][] };

const BULLET = /^\s*[-*•+]\s+(.*)$/;
const ORDERED = /^\s*(\d{1,3})[.)]\s+(.*)$/;
const HEADING = /^\s*#{1,6}\s+(.*)$/;

/** `mã` · **đậm** · *nghiêng* — nội dung không được bắt đầu/kết thúc bằng dấu cách ("8GB * 2" không phải in nghiêng) */
const INLINE = /`([^`]+)`|\*\*(\S(?:.*?\S)?)\*\*|\*([^\s*](?:[^*]*?[^\s*])?)\*/;

export function parseInline(text: string): InlineNode[] {
  const nodes: InlineNode[] = [];
  let rest = text;

  while (rest) {
    const match = INLINE.exec(rest);
    if (!match) {
      nodes.push({ type: "text", text: rest });
      break;
    }
    if (match.index > 0) nodes.push({ type: "text", text: rest.slice(0, match.index) });

    const [whole, code, strong, em] = match;
    if (code !== undefined) nodes.push({ type: "code", text: code });
    else if (strong !== undefined) nodes.push({ type: "strong", children: parseInline(strong) });
    else nodes.push({ type: "em", children: parseInline(em) });

    rest = rest.slice(match.index + whole.length);
  }

  return nodes;
}

export function parseChatMarkdown(text: string): ChatBlock[] {
  const blocks: ChatBlock[] = [];
  // Khối đang mở để nối tiếp dòng sau vào; dòng trống đóng khối
  let open: ChatBlock | null = null;

  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      open = null;
      continue;
    }

    const bullet = BULLET.exec(line);
    const ordered = bullet ? null : ORDERED.exec(line);
    if (bullet || ordered) {
      const isOrdered = ordered !== null;
      if (open === null || open.type !== "list" || open.ordered !== isOrdered) {
        open = { type: "list", ordered: isOrdered, start: ordered ? Number(ordered[1]) : 1, items: [] };
        blocks.push(open);
      }
      open.items.push(parseInline(bullet ? bullet[1] : ordered![2]));
      continue;
    }

    const heading = HEADING.exec(line);
    const inline: InlineNode[] = heading ? [{ type: "strong", children: parseInline(heading[1]) }] : parseInline(line.trim());
    if (open === null || open.type !== "paragraph") {
      open = { type: "paragraph", lines: [] };
      blocks.push(open);
    }
    open.lines.push(inline);
  }

  return blocks;
}
