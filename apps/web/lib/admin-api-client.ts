/**
 * Bản `apiFetch` riêng cho khu quản trị — phiên đăng nhập admin dùng cookie/endpoint refresh
 * khác hoàn toàn với khách hàng (`/api/admin/auth/refresh`, xem `apps/api/src/utils/cookies.ts`),
 * nên không dùng chung `apiFetch` của `api-client.ts` (nó sẽ gọi nhầm sang refresh của khách hàng).
 */
import { PUBLIC_API_URL } from "./config";
import { ApiError, createApiClient, toApiError } from "./api-client";
import type { AdminProductDetail } from "@/types";

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
 * Gửi `multipart/form-data` (tải ảnh lên) — `adminApiFetch` luôn `JSON.stringify` body nên không gửi được. Gặp 401
 * (access token hết hạn khi quản trị viên để trang mở lâu) thì làm mới phiên rồi gửi lại đúng một lần, như `apiFetch`:
 * FormData gửi lại được nguyên vẹn. Lỗi trả về theo đúng định dạng JSON chung của API (`toApiError`).
 */
async function postAdminForm<T>(path: string, formData: FormData): Promise<T> {
  const send = async () => {
    try {
      return await fetch(`${PUBLIC_API_URL}${path}`, { method: "POST", credentials: "include", body: formData });
    } catch {
      throw new ApiError("Không kết nối được máy chủ. Vui lòng kiểm tra kết nối rồi thử lại.", 0);
    }
  };

  let response = await send();
  if (response.status === 401 && (await adminClient.renewSession())) response = await send();
  if (!response.ok) throw await toApiError(response);
  return response.json();
}

/** Ảnh banner: một file, trường "image" — trả về URL để đưa vào form tạo/sửa banner */
export async function uploadAdminImage(path: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("image", file);
  return postAdminForm(path, formData);
}

/** Ảnh sản phẩm: nhiều file, trường "images" — thêm vào cuối bộ ảnh, trả về sản phẩm với bộ ảnh mới */
export async function uploadAdminProductImages(productId: string, files: File[]): Promise<AdminProductDetail> {
  const formData = new FormData();
  for (const file of files) formData.append("images", file, file.name);
  return postAdminForm(`/api/admin/products/${encodeURIComponent(productId)}/images`, formData);
}

/**
 * Tải file nhị phân (báo cáo Excel) và tự lưu về máy — `adminApiFetch` luôn parse JSON nên không
 * dùng được cho response là file. Đọc tên file thật từ header `Content-Disposition` server đã đặt
 * (kèm khoảng thời gian báo cáo) thay vì tự đoán tên ở phía trình duyệt.
 */
export async function downloadAdminFile(path: string): Promise<void> {
  const response = await fetch(`${PUBLIC_API_URL}${path}`, { credentials: "include" });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new ApiError(typeof payload?.message === "string" ? payload.message : `Máy chủ trả về lỗi ${response.status}`, response.status);
  }

  const disposition = response.headers.get("Content-Disposition") ?? "";
  const filename = /filename="([^"]+)"/.exec(disposition)?.[1] ?? "bao-cao.xlsx";

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
