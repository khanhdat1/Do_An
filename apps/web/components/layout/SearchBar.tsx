"use client";

import { Suspense, useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LoaderCircle, Search, Sparkles, X } from "lucide-react";
import SuggestPanel, { type SuggestNotice } from "@/components/search/SuggestPanel";
import { clearRecentSearches, fetchSuggestions, readRecentSearches, rememberSearch } from "@/lib/search-client";
import { cleanQuery, searchHref } from "@/lib/search-query";
import { MIN_SUGGEST_LENGTH, idleRows, queryRows, searchTextOf } from "@/lib/search-suggest";
import { cn } from "@/lib/utils";
import type { SearchSuggestions } from "@/types";

interface SearchBarProps {
  className?: string;
}

/** Gõ xong chờ chừng này mới hỏi API: gõ nhanh "laptop" chỉ tốn một lần gọi thay vì sáu */
const DEBOUNCE_MS = 180;

const SEARCH_PATH = "/tim-kiem";

/** Câu trả lời của API gợi ý cho một câu gõ; `data` là null khi lần gọi đó bị lỗi */
interface Answer {
  query: string;
  data: SearchSuggestions | null;
}

/**
 * Đọc câu tìm kiếm đang có trên URL (chỉ ở trang tìm kiếm) rồi báo lên để ô nhập hiện đúng chữ đó, kể cả khi mở bằng
 * liên kết hay bấm Back. Tách riêng vì `useSearchParams` buộc phải nằm trong Suspense ở trang dựng sẵn: đặt ở đây thì
 * Suspense chỉ bao đúng đoạn nhỏ này chứ không bao cả ô tìm kiếm (ô tìm kiếm vẫn có trong HTML server gửi về).
 */
function UrlQuery({ onChange }: { onChange: (query: string) => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = pathname === SEARCH_PATH ? cleanQuery(searchParams.get("q") ?? undefined) : "";

  useEffect(() => {
    onChange(query);
  }, [query, onChange]);

  return null;
}

/**
 * Ô tìm kiếm lớn ở giữa header, kèm nút "AI SEARCH".
 *
 * Gõ từ 2 ký tự thì hiện hộp gợi ý (sản phẩm, danh mục, hãng); bấm Enter hoặc nút tìm thì chuyển tới trang kết quả
 * `/tim-kiem?q=...`. Ô nhập là một combobox: tiêu điểm nằm ở ô nhập suốt, mũi tên lên/xuống chọn dòng trong hộp.
 * Nút "AI Search" hiện chạy tìm kiếm từ khoá thông minh (hiểu giá, không dấu, từ đồng nghĩa), chưa phải AI.
 */
export default function SearchBar({ className }: SearchBarProps) {
  const router = useRouter();
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  /** Bộ gõ tiếng Việt (Telex/VNI) đang ghép chữ: phím lúc này thuộc về bộ gõ */
  const composing = useRef(false);

  const [keyword, setKeyword] = useState("");
  /** Câu gõ sau khi dừng tay một lúc: chỉ câu này mới được đem đi hỏi API */
  const [settled, setSettled] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [recent, setRecent] = useState<string[]>([]);

  const typed = cleanQuery(keyword);
  const searching = typed.length >= MIN_SUGGEST_LENGTH;

  useEffect(() => {
    const timer = setTimeout(() => setSettled(typed), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  // Chỉ hỏi khi hộp đang mở: mở trang tìm kiếm với sẵn một câu trên URL không cần gọi API gợi ý
  useEffect(() => {
    if (!open || settled.length < MIN_SUGGEST_LENGTH) return;

    const controller = new AbortController();
    fetchSuggestions(settled, controller.signal)
      .then((data) => {
        setAnswer({ query: settled, data });
        setActive(-1);
      })
      .catch(() => {
        // Huỷ vì đã gõ tiếp hoặc đóng hộp thì không phải lỗi
        if (!controller.signal.aborted) setAnswer({ query: settled, data: null });
      });

    return () => controller.abort();
  }, [settled, open]);

  const fresh = answer?.query === typed;
  const failed = fresh && answer.data === null;
  // Câu trả lời của câu gõ trước vẫn hiện (mờ đi) trong lúc chờ câu mới, đỡ nhấp nháy mỗi phím
  const data = answer?.data ?? null;

  const rows = searching ? queryRows(typed, data, fresh) : idleRows(recent);
  const activeIndex = active < rows.length ? active : -1;

  let notice: SuggestNotice | undefined;
  if (searching) {
    if (failed) notice = { tone: "info", text: "Không tải được gợi ý, bạn vẫn có thể nhấn Enter để tìm." };
    else if (!fresh && !data) notice = { tone: "loading", text: "Đang tìm gợi ý…" };
    else if (fresh && data?.total === 0) notice = { tone: "info", text: `Chưa có gợi ý nhanh cho “${typed}”.` };
  }

  const loading = open && searching && !fresh;
  const announcement =
    open && searching && fresh && data
      ? data.total > 0
        ? `${data.total} sản phẩm phù hợp. Dùng phím mũi tên lên xuống để chọn.`
        : "Chưa có gợi ý."
      : "";

  /** Xong việc chọn: điền chữ vào ô và nhớ câu tìm (nếu là một câu tìm), đóng hộp, hạ bàn phím trên điện thoại */
  const settle = (search?: string) => {
    if (search) {
      setKeyword(search);
      setRecent(rememberSearch(search));
    }
    setOpen(false);
    setActive(-1);
    inputRef.current?.blur();
  };

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const search = cleanQuery(keyword);

    // Chưa gõ gì: không có gì để tìm, mở gợi ý (tìm gần đây, phổ biến) cho người dùng chọn
    if (!search) {
      inputRef.current?.focus();
      setOpen(true);
      return;
    }

    settle(search);
    router.push(searchHref(search));
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    // keyCode 229: Safari báo phím Enter chốt chữ của bộ gõ bằng keydown "bình thường" ngay sau compositionend
    if (composing.current || event.nativeEvent.isComposing || event.keyCode === 229) return;

    switch (event.key) {
      case "ArrowDown":
      case "ArrowUp": {
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        const step = event.key === "ArrowDown" ? 1 : -1;
        setActive(activeIndex === -1 ? (step === 1 ? 0 : rows.length - 1) : (activeIndex + step + rows.length) % rows.length);
        return;
      }

      case "Enter": {
        const row = open && activeIndex >= 0 ? rows[activeIndex] : undefined;
        // Chưa chọn dòng nào thì để form tự gửi câu đang gõ
        if (!row) return;
        event.preventDefault();
        settle(searchTextOf(row));
        router.push(row.href);
        return;
      }

      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
          setActive(-1);
        } else if (keyword) {
          event.preventDefault();
          setKeyword("");
        }
        return;
    }
  }

  return (
    <div
      className={cn("relative w-full", className)}
      onBlur={(event) => {
        // Tiêu điểm còn ở trong ô tìm kiếm (ô nhập, nút xoá, nút tìm) thì hộp vẫn mở
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setOpen(false);
        setActive(-1);
      }}
    >
      <form
        onSubmit={handleSubmit}
        role="search"
        className="flex h-12 w-full items-center rounded-xl bg-white p-1.5 shadow-lg shadow-black/20 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-gold-400"
      >
        {loading ? (
          <LoaderCircle className="ml-2.5 size-4.5 shrink-0 animate-spin text-slate-400" />
        ) : (
          <Search className="ml-2.5 size-4.5 shrink-0 text-slate-400" />
        )}
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          value={keyword}
          onChange={(event) => {
            setKeyword(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onFocus={() => {
            // Đọc lịch sử lúc mở hộp (chứ không lúc dựng trang) để luôn mới, kể cả khi vừa tìm ở tab khác
            setRecent(readRecentSearches());
            setOpen(true);
          }}
          onClick={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composing.current = true;
          }}
          onCompositionEnd={() => {
            composing.current = false;
          }}
          placeholder="Tìm laptop, RTX 5070, bàn phím cơ… hoặc “PC dưới 20 triệu”"
          aria-label="Tìm kiếm sản phẩm"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="search"
          className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
        />
        {keyword ? (
          <button
            type="button"
            aria-label="Xóa nội dung tìm kiếm"
            onClick={() => {
              setKeyword("");
              setActive(-1);
              inputRef.current?.focus();
            }}
            className="mr-1 grid size-8 shrink-0 place-items-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        ) : null}
        <button
          type="submit"
          aria-label="Tìm kiếm"
          className="flex h-full shrink-0 items-center gap-1.5 rounded-lg bg-gold-400 px-3 text-xs font-bold uppercase tracking-wide text-ink-950 transition hover:bg-gold-300 sm:px-4"
        >
          <Sparkles className="size-4" />
          <span className="hidden sm:inline">AI Search</span>
        </button>
      </form>

      {open ? (
        <SuggestPanel
          id={listId}
          rows={rows}
          active={activeIndex}
          terms={data?.terms ?? []}
          stale={searching && !fresh && data !== null}
          notice={notice}
          onHover={setActive}
          onLeave={() => setActive(-1)}
          onPick={(row) => settle(searchTextOf(row))}
          onClearRecent={
            !searching && recent.length > 0
              ? () => {
                  clearRecentSearches();
                  setRecent([]);
                }
              : undefined
          }
        />
      ) : null}

      <p role="status" className="sr-only">
        {announcement}
      </p>

      <Suspense fallback={null}>
        <UrlQuery onChange={setKeyword} />
      </Suspense>
    </div>
  );
}
