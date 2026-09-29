"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { DEFAULT_PUBLIC_SETTINGS } from "@/lib/data/store-settings";
import type { PublicSettings } from "@/types";

const StoreSettingsContext = createContext<PublicSettings>(DEFAULT_PUBLIC_SETTINGS);

/**
 * Cài đặt công khai của cửa hàng (`GET /api/settings`) cho các client component: phí vận chuyển xem trước ở giỏ
 * hàng/đặt hàng, tính năng AI nào đang bật (trợ lý AI, AI gợi ý cấu hình)...
 *
 * Layout (server) truyền sẵn bản đã lấy lúc dựng trang nên lần render đầu không nháy số và khớp bản HTML từ server.
 * Bản đó có thể cũ tới 60 giây (cache ISR của `lib/api.ts`), nên vào trang xong hỏi lại API một lần (không cache)
 * để số trên giỏ hàng khớp đúng số chủ website vừa lưu — số THẬT lúc tạo đơn vẫn luôn do API tự tính lại.
 */
export function StoreSettingsProvider({ initial, children }: { initial: PublicSettings; children: React.ReactNode }) {
  const [settings, setSettings] = useState<PublicSettings>(initial);

  useEffect(() => {
    let cancelled = false;
    apiFetch<PublicSettings>("/api/settings")
      .then((fresh) => {
        if (!cancelled) setSettings(fresh);
      })
      .catch(() => {
        // Không gọi được API thì giữ bản layout đã truyền (hoặc mặc định) — không đáng báo lỗi cho khách
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <StoreSettingsContext.Provider value={settings}>{children}</StoreSettingsContext.Provider>;
}

export function useStoreSettings(): PublicSettings {
  return useContext(StoreSettingsContext);
}
