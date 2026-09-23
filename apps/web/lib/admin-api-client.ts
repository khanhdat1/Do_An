/**
 * Bản `apiFetch` riêng cho khu quản trị — phiên đăng nhập admin dùng cookie/endpoint refresh
 * khác hoàn toàn với khách hàng (`/api/admin/auth/refresh`, xem `apps/api/src/utils/cookies.ts`),
 * nên không dùng chung `apiFetch` của `api-client.ts` (nó sẽ gọi nhầm sang refresh của khách hàng).
 */
import { createApiClient } from "./api-client";

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
