"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useToast } from "@/components/providers/ToastProvider";
import { COMPARE_MAX, clearCompareSlugs, readCompareSlugs, removeCompareSlug, toggleCompareSlug } from "@/lib/compare-client";

interface CompareContextValue {
  slugs: string[];
  toggle: (slug: string) => void;
  remove: (slug: string) => void;
  clear: () => void;
}

const CompareContext = createContext<CompareContextValue | null>(null);

/**
 * Danh sách so sánh sản phẩm — chỉ lưu ở trình duyệt (`lib/compare-client.ts`), không cần đăng nhập.
 * `slugs` bắt đầu rỗng (khớp bản render server) rồi nạp lại từ localStorage ngay khi vào trang —
 * đây là side effect đọc nguồn dữ liệu ngoài React lúc mount, không phải suy ra state từ props.
 */
export function CompareProvider({ children }: { children: React.ReactNode }) {
  const toast = useToast();
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    // Đọc localStorage ngay lúc mount — không có cách nào khác để giữ bản render đầu ở server/client
    // khớp nhau (SSR không có localStorage) rồi mới cập nhật đúng dữ liệu thật của trình duyệt. Đây là
    // trường hợp cần thiết phải setState đồng bộ trong effect, không phải state suy ra được từ props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSlugs(readCompareSlugs());
  }, []);

  function toggle(slug: string) {
    setSlugs((current) => {
      if (!current.includes(slug) && current.length >= COMPARE_MAX) {
        toast.error(`Chỉ so sánh được tối đa ${COMPARE_MAX} sản phẩm`);
        return current;
      }
      return toggleCompareSlug(current, slug);
    });
  }

  function remove(slug: string) {
    setSlugs((current) => removeCompareSlug(current, slug));
  }

  function clear() {
    setSlugs(clearCompareSlugs());
  }

  return <CompareContext.Provider value={{ slugs, toggle, remove, clear }}>{children}</CompareContext.Provider>;
}

export function useCompare(): CompareContextValue {
  const context = useContext(CompareContext);
  if (!context) throw new Error("useCompare phải dùng bên trong CompareProvider");
  return context;
}
