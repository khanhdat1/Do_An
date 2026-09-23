"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { adminApiFetch, onAdminSessionExpired } from "@/lib/admin-api-client";
import type { AdminLoginResult, AdminUser } from "@/types";

type AdminAuthStatus = "loading" | "authenticated" | "anonymous";

interface AdminAuthState {
  status: AdminAuthStatus;
  user: AdminUser | null;
}

export interface AdminLoginInput {
  email: string;
  password: string;
  remember?: boolean;
}

interface AdminAuthContextValue extends AdminAuthState {
  /** Trả nguyên kết quả — trang /admin/login tự xử lý nhánh "2fa-required" */
  login: (input: AdminLoginInput) => Promise<AdminLoginResult>;
  verifyLogin2fa: (pendingToken: string, code: string) => Promise<AdminUser>;
  logout: () => Promise<void>;
  /** Gọi lại /me — dùng sau khi bật/tắt 2FA để totpEnabled cập nhật đúng */
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

const ANONYMOUS: AdminAuthState = { status: "anonymous", user: null };

function authenticated(user: AdminUser): AdminAuthState {
  return { status: "authenticated", user };
}

/** Giữ trạng thái đăng nhập cho KHU QUẢN TRỊ — hoàn toàn tách biệt AuthProvider của khách hàng */
export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AdminAuthState>({ status: "loading", user: null });

  /** Dùng cho cả lần tải đầu tiên lẫn `refresh()` gọi tay sau này (vd. sau khi bật/tắt 2FA) */
  const loadMe = useCallback(async () => {
    try {
      const { user } = await adminApiFetch<{ user: AdminUser }>("/api/admin/auth/me");
      setState(authenticated(user));
    } catch {
      setState(ANONYMOUS);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    adminApiFetch<{ user: AdminUser }>("/api/admin/auth/me")
      .then(({ user }) => {
        if (!cancelled) setState(authenticated(user));
      })
      .catch(() => {
        if (!cancelled) setState(ANONYMOUS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => onAdminSessionExpired(() => setState(ANONYMOUS)), []);

  const login = useCallback(async (input: AdminLoginInput) => {
    const result = await adminApiFetch<AdminLoginResult>("/api/admin/auth/login", { method: "POST", body: input });
    if (result.status === "ok") setState(authenticated(result.user));
    return result;
  }, []);

  const verifyLogin2fa = useCallback(async (pendingToken: string, code: string) => {
    const { user } = await adminApiFetch<{ user: AdminUser }>("/api/admin/auth/login/verify-2fa", {
      method: "POST",
      body: { pendingToken, code },
    });
    setState(authenticated(user));
    return user;
  }, []);

  const logout = useCallback(async () => {
    await adminApiFetch<void>("/api/admin/auth/logout", { method: "POST" });
    setState(ANONYMOUS);
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({ ...state, login, verifyLogin2fa, logout, refresh: loadMe }),
    [state, login, verifyLogin2fa, logout, loadMe],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth phải được dùng bên trong <AdminAuthProvider>");
  return context;
}
