/**
 * Mật khẩu quản trị "mặc định" từng được seed tạo sẵn và in công khai trong README cũ ("admin123"). Bản dump DB dev
 * (deploy/export-data.sh) mang nguyên tài khoản này lên máy chủ, nên:
 * - bản chạy thật (NODE_ENV=production) từ chối đăng nhập quản trị bằng mật khẩu này (`isDefaultAdminLoginBlocked`);
 * - lúc khởi động, API liệt kê tài khoản quản trị còn dùng nó để cảnh báo (`admin-auth.service.ts`).
 * Không chặn cả API khởi động: đổi mật khẩu trên máy chủ cần API đang chạy (`docker compose exec ... create-admin.mts`).
 */
export const KNOWN_DEFAULT_ADMIN_PASSWORDS: readonly string[] = ["admin123"];

export function isKnownDefaultAdminPassword(password: string): boolean {
  return KNOWN_DEFAULT_ADMIN_PASSWORDS.includes(password);
}

export function isDefaultAdminLoginBlocked(isProduction: boolean, password: string): boolean {
  return isProduction && isKnownDefaultAdminPassword(password);
}

export const DEFAULT_ADMIN_PASSWORD_MESSAGE =
  "Tài khoản này vẫn dùng mật khẩu mặc định nên không được đăng nhập trên bản chạy thật. Hãy đặt mật khẩu mới bằng script create-admin.mts (README mục 14).";

/**
 * Giá trị mẫu của JWT_SECRET trong `.env.example` — đủ dài để qua kiểm tra độ dài tối thiểu nên trước đây ai chép
 * nguyên file mẫu là chạy với khoá công khai. `env.ts` từ chối khởi động khi gặp giá trị này.
 */
export const EXAMPLE_JWT_SECRETS: readonly string[] = ["thay-bang-chuoi-ngau-nhien-dai-it-nhat-32-ky-tu"];

export function isExampleJwtSecret(value: string): boolean {
  return EXAMPLE_JWT_SECRETS.includes(value.trim());
}
