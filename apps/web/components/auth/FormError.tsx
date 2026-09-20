import { CircleAlert } from "lucide-react";

/** Khung báo lỗi chung của cả form (sai mật khẩu, mất kết nối...) — đặt ngay trên nút gửi để luôn nằm trong tầm nhìn */
export default function FormError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2.5 rounded-lg bg-sale-500/10 px-3.5 py-3 text-sm text-sale-700 ring-1 ring-sale-500/25"
    >
      <CircleAlert className="mt-0.5 size-4.5 shrink-0" />
      {message}
    </div>
  );
}
