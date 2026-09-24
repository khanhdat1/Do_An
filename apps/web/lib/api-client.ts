/**
 * Lớp gọi Express API từ TRÌNH DUYỆT — dùng cho phần gắn với người dùng:
 * đăng nhập, giỏ hàng.
 *
 * Khác `lib/api.ts` (chạy trên server, cache ISR, có dữ liệu dự phòng khi API
 * tắt): dữ liệu ở đây là của riêng từng người nên không cache và không có dữ
 * liệu dự phòng — API không trả lời thì phải báo lỗi thật.
 *
 * Xác thực bằng cookie httpOnly do API đặt (`credentials: "include"`); JavaScript
 * ở đây không nhìn thấy token, nên XSS cũng không lấy cắp được.
 */

import { PUBLIC_API_URL } from "./config";

const API_BASE = PUBLIC_API_URL;

const NETWORK_ERROR_MESSAGE =
  "Không kết nối được máy chủ. Vui lòng kiểm tra kết nối rồi thử lại.";

export class ApiError extends Error {
  constructor(
    message: string,
    /** Mã HTTP; 0 nghĩa là không tới được máy chủ */
    readonly status: number,
    /** Lỗi theo từng ô nhập, ví dụ { email: "Email không hợp lệ" } */
    readonly fieldErrors: Record<string, string> = {},
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Lấy thông điệp hiển thị cho người dùng từ một lỗi bất kỳ */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError) return error.message;
  return "Đã có lỗi xảy ra. Vui lòng thử lại.";
}

interface ApiRequest {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
}

/* -------------------------------------------------------------------------- */
/*  apiFetch (nhà máy dùng chung — bên dưới tạo bản cho khách hàng; xem         */
/*  admin-api-client.ts cho bản admin, phiên riêng nên refresh path khác)     */
/* -------------------------------------------------------------------------- */

async function send(path: string, request: ApiRequest): Promise<Response> {
  const hasBody = request.body !== undefined;

  try {
    return await fetch(`${API_BASE}${path}`, {
      method: request.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? JSON.stringify(request.body) : undefined,
      signal: request.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }
}

export async function toApiError(response: Response): Promise<ApiError> {
  let payload: {
    message?: unknown;
    details?: { field?: unknown; message?: unknown }[];
  } | null = null;

  try {
    payload = await response.json();
  } catch {
    // Body không phải JSON (lỗi từ proxy, trang HTML...) — dùng thông điệp mặc định bên dưới
  }

  const fieldErrors: Record<string, string> = {};
  for (const detail of payload?.details ?? []) {
    if (typeof detail.field === "string" && typeof detail.message === "string") {
      fieldErrors[detail.field] ??= detail.message;
    }
  }

  const message =
    Object.values(fieldErrors)[0] ??
    (typeof payload?.message === "string" ? payload.message : null) ??
    `Máy chủ trả về lỗi ${response.status}`;

  return new ApiError(message, response.status, fieldErrors);
}

export interface ApiClientOptions {
  /** Endpoint đổi refresh token cookie lấy access token mới */
  refreshPath: string;
  /** Các endpoint tự trả 401 vì lý do riêng (sai mật khẩu...) — không được đi thử refresh */
  noRefreshPaths: Set<string>;
}

/**
 * Dựng một bộ `apiFetch`/`onSessionExpired`/`renewSession` hoàn chỉnh cho MỘT loại phiên đăng
 * nhập. Khách hàng và admin có cookie/endpoint refresh khác nhau hoàn toàn (xem cookies.ts phía
 * API) nên cần hai bộ độc lập — `admin-api-client.ts` gọi lại đúng hàm này với đường dẫn riêng
 * thay vì chép lại logic bên dưới.
 */
export function createApiClient(options: ApiClientOptions) {
  const sessionExpiredListeners = new Set<() => void>();
  let refreshInFlight: Promise<boolean> | null = null;

  function onSessionExpired(listener: () => void): () => void {
    sessionExpiredListeners.add(listener);
    return () => {
      sessionExpiredListeners.delete(listener);
    };
  }

  /**
   * Nhiều request cùng gặp 401 một lúc sẽ dùng chung MỘT lần refresh: refresh token xoay vòng
   * sau mỗi lần dùng, gọi song song sẽ giẫm chân nhau.
   */
  function refreshSession(): Promise<boolean> {
    refreshInFlight ??= fetch(`${API_BASE}${options.refreshPath}`, {
      method: "POST",
      credentials: "include",
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshInFlight = null;
      });

    return refreshInFlight;
  }

  /**
   * Làm mới phiên ngay, không chờ một request bị 401. Dùng trước khi rời trang bằng điều
   * hướng (vd. sang Facebook để liên kết): điều hướng không tự refresh được như fetch, mà
   * API cần thấy access token còn hạn. Trả về false nếu phiên đã chết, đồng thời báo
   * Provider chuyển về trạng thái khách.
   */
  async function renewSession(): Promise<boolean> {
    const renewed = await refreshSession();
    if (!renewed) {
      for (const listener of sessionExpiredListeners) listener();
    }
    return renewed;
  }

  /**
   * Gọi API và trả về JSON đã parse. Lỗi được ném dưới dạng `ApiError`.
   *
   * Khi gặp 401 (access token hết hạn) sẽ tự refresh rồi thử lại đúng một lần.
   * Nếu refresh thất bại, báo phiên đã chết, nhưng vẫn thử lại request một lần nữa: server đã
   * dọn cookie hỏng nên lần này request đi như khách vãng lai (các endpoint công khai vẫn trả lời
   * bình thường).
   */
  async function apiFetch<T>(path: string, request: ApiRequest = {}): Promise<T> {
    let response = await send(path, request);

    if (response.status === 401 && !options.noRefreshPaths.has(path)) {
      const refreshed = await refreshSession();
      if (!refreshed) {
        for (const listener of sessionExpiredListeners) listener();
      }
      response = await send(path, request);
    }

    if (!response.ok) throw await toApiError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  return { apiFetch, onSessionExpired, renewSession };
}

const customerClient = createApiClient({
  refreshPath: "/api/auth/refresh",
  noRefreshPaths: new Set(["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"]),
});

export const apiFetch = customerClient.apiFetch;
export const onSessionExpired = customerClient.onSessionExpired;
export const renewSession = customerClient.renewSession;
