import { tmpdir } from "node:os";
import { join } from "node:path";

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

/**
 * Thư mục ảnh sản phẩm của API kiểm thử (IMAGE_STORAGE_DIR): ảnh test tải lên không lẫn vào thư mục ảnh thật của máy dev,
 * và vì không nằm trong `apps/web/public/` nên kiểm luôn đường web lấy ảnh vừa tải lên từ API (apps/web/next.config.ts).
 */
export const E2E_IMAGE_DIR = process.env.E2E_IMAGE_DIR ?? join(tmpdir(), "pczone-e2e-product-images");
