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

/** Như trên, cho ảnh banner quản trị tải lên (BANNER_IMAGE_DIR) — kiểm luôn đường web lấy banner vừa tải lên từ API */
export const E2E_BANNER_DIR = process.env.E2E_BANNER_DIR ?? join(tmpdir(), "pczone-e2e-banners");

/**
 * VNPay GIẢ cho API kiểm thử: khoá tự đặt, không phải khoá sandbox thật, và URL cổng trỏ về một đường dẫn không tồn tại
 * của chính API kiểm thử — không bao giờ gọi tới VNPay. Có khoá thì đặt được đơn VNPay, còn kiểm thử tự ký "IPN" bằng
 * đúng khoá này để giả lập VNPay báo kết quả (TC24/TC25 trong order-edge-cases.spec.ts).
 */
export const E2E_VNPAY = {
  tmnCode: "E2ETEST1",
  hashSecret: "pczone-e2e-vnpay-khoa-gia-khong-dung-that",
  payUrl: `${API_URL}/e2e-vnpay-gia`,
};

/**
 * Tài khoản quản trị của DB kiểm thử. Seed không còn mật khẩu cố định: prepare-db.mjs truyền `SEED_ADMIN_PASSWORD` để seed
 * đặt đúng mật khẩu này (playwright.config.ts, playwright.api-only.config.ts).
 */
export const E2E_ADMIN = { email: "admin@pczone.vn", password: "E2e-Admin-2026" };

/** Biến môi trường VNPay giả truyền cho API kiểm thử (playwright.config.ts, playwright.api-only.config.ts) */
export const E2E_VNPAY_ENV = {
  VNPAY_TMN_CODE: E2E_VNPAY.tmnCode,
  VNPAY_HASH_SECRET: E2E_VNPAY.hashSecret,
  VNPAY_PAY_URL: E2E_VNPAY.payUrl,
};
