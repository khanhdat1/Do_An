import { z } from "zod";

/**
 * Số điện thoại Việt Nam: cho phép gõ có dấu cách / gạch, chuẩn hoá về một dạng duy nhất trước khi lưu
 * hoặc so khớp (đơn hàng huỷ ghi "090 123 4567" mà tra cứu gõ "0901234567" vẫn phải khớp).
 * Bản sao rút gọn của schema riêng trong `auth.routes.ts` (chỗ đó còn cho phép rỗng vì số điện thoại
 * hồ sơ là tuỳ chọn); ở đây luôn bắt buộc vì là số nhận hàng.
 */
export const phoneSchema = z
  .string({ error: "Vui lòng nhập số điện thoại" })
  .trim()
  .transform((value) => value.replace(/[\s.-]/g, ""))
  .pipe(z.string().regex(/^(0|\+84)\d{9,10}$/, "Số điện thoại không hợp lệ"));

/** Các trường của một địa chỉ giao hàng — dùng chung cho sổ địa chỉ (`addresses.routes.ts`) và địa chỉ nhập mới lúc đặt hàng (`orders.routes.ts`) */
export const addressInputSchema = z.object({
  recipientName: z
    .string({ error: "Vui lòng nhập tên người nhận" })
    .trim()
    .min(2, "Tên quá ngắn")
    .max(150, "Tên quá dài"),
  phone: phoneSchema,
  province: z.string({ error: "Vui lòng nhập tỉnh/thành phố" }).trim().min(1, "Vui lòng nhập tỉnh/thành phố").max(100),
  district: z.string({ error: "Vui lòng nhập quận/huyện" }).trim().min(1, "Vui lòng nhập quận/huyện").max(100),
  ward: z.string({ error: "Vui lòng nhập phường/xã" }).trim().min(1, "Vui lòng nhập phường/xã").max(100),
  streetAddress: z
    .string({ error: "Vui lòng nhập số nhà, tên đường" })
    .trim()
    .min(3, "Địa chỉ quá ngắn")
    .max(300, "Địa chỉ quá dài"),
  note: z.string().trim().max(500).optional(),
});
