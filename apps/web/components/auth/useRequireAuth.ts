"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/AuthProvider";
import { authHref } from "@/lib/navigation";
import type { AuthUser } from "@/types";

/**
 * Chặn trang chỉ dành cho người đã đăng nhập.
 *
 * Trả về người dùng khi đã đăng nhập, `null` trong lúc đang kiểm tra hoặc khi
 * đang chuyển hướng sang trang đăng nhập (kèm `?next=` để đăng nhập xong quay
 * lại đúng trang này). Trang dùng kết quả để quyết định hiện nội dung hay khung chờ.
 *
 * Đây là kiểm tra phía giao diện, không thay thế việc API tự kiểm tra quyền.
 */
export function useRequireAuth(next: string): AuthUser | null {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "anonymous") router.replace(authHref("/dang-nhap", next));
  }, [status, next, router]);

  return status === "authenticated" ? user : null;
}
