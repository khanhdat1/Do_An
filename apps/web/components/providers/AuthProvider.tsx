"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiFetch, onSessionExpired } from "@/lib/api-client";
import type { AuthUser } from "@/types";

/** `loading` = chưa biết đã đăng nhập hay chưa (đang hỏi /api/auth/me lần đầu) */
type AuthStatus = "loading" | "authenticated" | "anonymous";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
}

export interface LoginInput {
  email: string;
  password: string;
  /** Ô "Ghi nhớ đăng nhập trên thiết bị này". false = phiên chỉ sống tới khi đóng trình duyệt. */
  remember?: boolean;
}

export interface RegisterInput {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
}

interface AuthContextValue extends AuthState {
  login: (input: LoginInput) => Promise<AuthUser>;
  register: (input: RegisterInput) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const ANONYMOUS: AuthState = { status: "anonymous", user: null };

function authenticated(user: AuthUser): AuthState {
  return { status: "authenticated", user };
}

/**
 * Giữ trạng thái đăng nhập cho toàn site.
 *
 * Token nằm trong cookie httpOnly nên JavaScript không đọc được: cách duy nhất
 * biết mình đã đăng nhập chưa là hỏi API. Vì vậy trạng thái đầu tiên luôn là
 * `loading`, giao diện phải chịu được việc "chưa biết" trong vài chục mili giây
 * (không hiện nhầm nút "Đăng nhập" cho người đã đăng nhập).
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    let cancelled = false;

    // Facebook luôn gắn "#_=_" vào địa chỉ sau khi đăng nhập xong; bỏ đi cho thanh địa chỉ gọn
    if (window.location.hash === "#_=_") {
      window.history.replaceState(null, "", window.location.pathname + window.location.search);
    }

    apiFetch<{ user: AuthUser | null }>("/api/auth/me")
      .then(({ user }) => {
        if (!cancelled) setState(user ? authenticated(user) : ANONYMOUS);
      })
      .catch(() => {
        // API tắt hoặc lỗi mạng: không xác định được thì coi là khách
        if (!cancelled) setState(ANONYMOUS);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh token hết hạn / bị thu hồi ở giữa phiên: về trạng thái khách
  useEffect(() => onSessionExpired(() => setState(ANONYMOUS)), []);

  const login = useCallback(async (input: LoginInput) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/login", {
      method: "POST",
      body: input,
    });
    setState(authenticated(user));
    return user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const { user } = await apiFetch<{ user: AuthUser }>("/api/auth/register", {
      method: "POST",
      body: input,
    });
    setState(authenticated(user));
    return user;
  }, []);

  const logout = useCallback(async () => {
    // Lỗi được ném ra cho nơi gọi xử lý: nếu server không xác nhận đã thu hồi
    // phiên thì không giả vờ là đã đăng xuất (cookie vẫn còn, tải lại trang là đăng nhập lại)
    await apiFetch<void>("/api/auth/logout", { method: "POST" });
    setState(ANONYMOUS);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, login, register, logout }),
    [state, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth phải được dùng bên trong <AuthProvider>");
  return context;
}
