"use client";

import { useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchBarProps {
  className?: string;
}

/**
 * Ô tìm kiếm lớn ở giữa header, kèm nút "AI SEARCH".
 *
 * Hiện tại chỉ xử lý state cục bộ. Khi có API, thay `handleSubmit`
 * bằng router.push(`/tim-kiem?q=...`) hoặc gọi endpoint AI search.
 */
export default function SearchBar({ className }: SearchBarProps) {
  const [keyword, setKeyword] = useState("");

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: nối với API tìm kiếm / AI search của backend
    console.log("Từ khoá tìm kiếm:", keyword);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        "flex h-12 w-full items-center rounded-xl bg-white p-1.5 shadow-lg shadow-black/20 ring-1 ring-white/10 focus-within:ring-2 focus-within:ring-gold-400",
        className,
      )}
      role="search"
    >
      <Search className="ml-2.5 size-4.5 shrink-0 text-slate-400" />
      <input
        type="search"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="Tìm kiếm laptop, RTX 4090, PC AI... hoặc hỏi AI Build PC"
        aria-label="Tìm kiếm sản phẩm"
        className="min-w-0 flex-1 bg-transparent px-3 text-sm text-slate-800 outline-none placeholder:text-slate-400"
      />
      <button
        type="submit"
        className="flex h-full shrink-0 items-center gap-1.5 rounded-lg bg-gold-400 px-3 text-xs font-bold uppercase tracking-wide text-ink-950 transition hover:bg-gold-300 sm:px-4"
      >
        <Sparkles className="size-4" />
        <span className="hidden sm:inline">AI Search</span>
      </button>
    </form>
  );
}
