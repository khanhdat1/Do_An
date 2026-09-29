/**
 * Cổng và DB RIÊNG cho kiểm thử đầu-cuối — không trùng server dev (web 3000 / API 4000) và DB thật `pczone`.
 * DB kiểm thử tự tạo ở lượt chạy đầu và được giữ lại giữa các lượt (`scripts/prepare-db.mjs` không xoá gì, và từ chối mọi
 * DB không có đuôi `_e2e`).
 * Mặc định `root:root` là tài khoản MySQL chạy bằng docker-compose của dự án trên máy dev.
 */
export const API_PORT = Number(process.env.E2E_API_PORT ?? 4101);
export const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3101);
export const API_URL = `http://127.0.0.1:${API_PORT}`;
export const WEB_URL = `http://127.0.0.1:${WEB_PORT}`;
export const E2E_DATABASE_URL = process.env.E2E_DATABASE_URL ?? "mysql://root:root@localhost:3306/pczone_e2e";
