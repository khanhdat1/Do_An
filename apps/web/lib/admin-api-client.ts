/**
 * Bản `apiFetch` riêng cho khu quản trị — phiên đăng nhập admin dùng cookie/endpoint refresh
 * khác hoàn toàn với khách hàng (`/api/admin/auth/refresh`, xem `apps/api/src/utils/cookies.ts`),
 * nên không dùng chung `apiFetch` của `api-client.ts` (nó sẽ gọi nhầm sang refresh của khách hàng).
 */
import { PUBLIC_API_URL } from "./config";
import { ApiError, createApiClient } from "./api-client";

const adminClient = createApiClient({
  refreshPath: "/api/admin/auth/refresh",
  noRefreshPaths: new Set([
    "/api/admin/auth/login",
    "/api/admin/auth/login/verify-2fa",
    "/api/admin/auth/refresh",
    "/api/admin/auth/logout",
  ]),
});

export const adminApiFetch = adminClient.apiFetch;
export const onAdminSessionExpired = adminClient.onSessionExpired;

export { ApiError, errorMessage } from "./api-client";

/**
 * Upload file duy nhất trong khu quản trị (ảnh banner) — `adminApiFetch` luôn `JSON.stringify` body
 * nên không gửi được `multipart/form-data`; viết riêng một hàm nhỏ thay vì mở rộng `apiFetch` cho
 * một trường hợp duy nhất. Không tự thử refresh lại phiên nếu 401 — nếu đúng lúc đó phiên hết hạn,
 * người dùng bấm upload lại là được, không đáng để lặp lại toàn bộ máy refresh cho một nút bấm.
 */
export async function uploadAdminImage(path: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${PUBLIC_API_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(typeof payload?.message === "string" ? payload.message : `Máy chủ trả về lỗi ${response.status}`, response.status);
  }

  return response.json();
}
