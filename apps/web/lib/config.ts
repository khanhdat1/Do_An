/**
 * URL công khai của API mà TRÌNH DUYỆT truy cập. Khác `API_URL` (địa chỉ nội bộ
 * mà Server Component dùng, có thể là tên service trong Docker): nút "Đăng nhập với
 * Google" là một liên kết trình duyệt bấm vào, nên phải là địa chỉ người dùng với tới được.
 */
export const PUBLIC_API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
