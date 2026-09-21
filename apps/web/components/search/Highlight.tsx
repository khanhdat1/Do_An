import { highlightParts } from "@/lib/search-text";

interface HighlightProps {
  text: string;
  /** Từ khoá không dấu (xem `queryTerms` / `SearchResult.terms`) */
  terms: string[];
}

/** Tô sáng các từ khoá tìm kiếm trong một đoạn chữ (tên sản phẩm ở kết quả và ở hộp gợi ý) */
export default function Highlight({ text, terms }: HighlightProps) {
  return (
    <>
      {highlightParts(text, terms).map((part, index) =>
        part.match ? (
          <mark key={index} className="rounded-sm bg-gold-400/35 px-0.5 text-inherit">
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        ),
      )}
    </>
  );
}
