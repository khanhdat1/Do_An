import { Prisma, prisma, type Voucher } from "@pczone/db";
import { toVoucherDto } from "../mappers/voucher.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { VoucherDto, VoucherPreviewResultDto } from "../types/dto.js";

/**
 * Mã giảm giá CÔNG KHAI — `Voucher` không có `userId`, ai cũng nhập được mã, chỉ giới hạn bởi
 * `usageLimit` (tổng lượt), `perUserLimit` (lượt của mỗi người, đếm qua `VoucherRedemption`),
 * `minOrderAmount` và khoảng ngày hiệu lực. Vì vậy trang liệt kê là "mã đang áp dụng được", không phải
 * sổ voucher riêng của một người (csdl.md mục 4.6).
 */
type Db = Prisma.TransactionClient;

/** Mã đang trong thời hạn, còn bật, còn lượt tổng — cho trang `/khuyen-mai` duyệt công khai */
export async function listActiveVouchers(): Promise<VoucherDto[]> {
  const now = new Date();
  const rows = await prisma.voucher.findMany({
    where: { isActive: true, startsAt: { lte: now }, endsAt: { gte: now } },
    orderBy: { endsAt: "asc" },
    take: 50,
  });

  // usageCount < usageLimit không viết được thành một điều kiện WHERE (so sánh hai cột cùng dòng,
  // Prisma không hỗ trợ nếu không viết SQL thô) nên lọc nốt ở đây — số lượng mã luôn nhỏ, không đáng lo
  return rows.filter((voucher) => voucher.usageLimit === null || voucher.usageCount < voucher.usageLimit).map(toVoucherDto);
}

export interface DiscountRule {
  discountType: "PERCENT" | "FIXED";
  /** % nếu PERCENT (vd 10 = 10%), VNĐ nếu FIXED — số thuần, KHÔNG phải Prisma Decimal */
  discountValue: number;
  /** Trần số tiền giảm; chỉ có ý nghĩa khi discountType = PERCENT */
  maxDiscount: number | null;
}

/**
 * Giảm giá thật sự áp dụng cho một subtotal: PERCENT tính theo %, có trần `maxDiscount`; FIXED là số
 * tiền cố định nhưng không vượt quá subtotal (đơn nhỏ hơn giá trị mã thì giảm tối đa bằng subtotal,
 * không thể giảm âm). Luôn là số nguyên VNĐ, không âm.
 *
 * Hàm THUẦN, nhận số thuần chứ không nhận `Voucher` của Prisma (`discountValue`/`maxDiscount` ở đó là
 * kiểu `Decimal`, không dựng tay được để test) — để test được không cần chạy DB, cùng tinh thần tách
 * `calcShippingFee` / `vnpay.service.ts` đã làm. Nơi gọi thật (`validateVoucherForOrder`) tự chuyển
 * `Decimal` sang `number` trước khi gọi.
 */
export function computeDiscountAmount(rule: DiscountRule, subtotal: number): number {
  let amount = rule.discountType === "PERCENT" ? (subtotal * rule.discountValue) / 100 : rule.discountValue;

  // Trần giảm giá chỉ có ý nghĩa với PERCENT — FIXED bản thân đã là số tiền cố định (csdl.md mục 4.6)
  if (rule.discountType === "PERCENT" && rule.maxDiscount !== null) {
    amount = Math.min(amount, rule.maxDiscount);
  }

  return Math.max(0, Math.min(Math.round(amount), Math.max(0, subtotal)));
}

const PER_USER_LIMIT_MESSAGE = "Bạn đã dùng hết lượt cho mã giảm giá này";

/**
 * Số lượt một người đã dùng một mã, đọc bằng `SELECT ... FOR UPDATE`. Transaction tạo đơn chạy ở REPEATABLE READ:
 * `count()` thường đọc ẢNH CHỤP từ câu đọc đầu tiên của transaction, nên không thấy lượt dùng mà đơn khác của cùng
 * người vừa commit trong lúc chờ khoá. Đọc có khoá thì InnoDB luôn đọc bản mới nhất đã commit (và giữ khoá tới hết
 * transaction). Prisma không có `FOR UPDATE` nên viết SQL thô — bảng/cột đúng tên model vì schema không dùng @@map.
 */
async function countRedemptionsLocked(db: Db, voucherId: string, userId: string): Promise<number> {
  const rows = await db.$queryRaw<{ used: bigint | number }[]>(
    Prisma.sql`SELECT COUNT(*) AS used FROM \`VoucherRedemption\` WHERE voucherId = ${voucherId} AND userId = ${userId} FOR UPDATE`,
  );
  return Number(rows[0]?.used ?? 0);
}

/**
 * Kiểm tra đầy đủ một mã cho một đơn cụ thể — CHỈ ĐỌC, không ghi gì. Nhận `db` kiểu
 * `Prisma.TransactionClient` (như `address.service.ts`) nên gọi được cả độc lập (`prisma` singleton,
 * lúc xem trước) lẫn lồng trong transaction tạo đơn (kiểm tra lại lần cuối, giống lý do phải kiểm tra
 * lại tồn kho dù giỏ hàng đã hiện ở trang trước đó).
 */
export async function validateVoucherForOrder(
  db: Db,
  params: { code: string; subtotal: number; userId: string },
): Promise<{ voucher: Voucher; discountAmount: number }> {
  const code = params.code.trim().toUpperCase();
  const voucher = await db.voucher.findUnique({ where: { code } });
  if (!voucher) throw new NotFoundError("Mã giảm giá không tồn tại");

  const now = new Date();
  if (!voucher.isActive) throw new ConflictError("Mã giảm giá đã bị tắt");
  if (now < voucher.startsAt) throw new ConflictError("Mã giảm giá chưa tới ngày áp dụng");
  if (now > voucher.endsAt) throw new ConflictError("Mã giảm giá đã hết hạn");

  if (voucher.minOrderAmount !== null && params.subtotal < Number(voucher.minOrderAmount)) {
    throw new ConflictError(
      `Đơn hàng cần tối thiểu ${Number(voucher.minOrderAmount).toLocaleString("vi-VN")}đ để dùng mã này`,
    );
  }

  if (voucher.usageLimit !== null && voucher.usageCount >= voucher.usageLimit) {
    throw new ConflictError("Mã giảm giá đã hết lượt sử dụng");
  }

  // Đọc thường, chỉ để báo sớm (kể cả lúc xem trước). Chặn thật — kể cả khi một người đặt hai đơn cùng lúc — nằm ở
  // `redeemVoucher`, đếm lại sau khi đã giữ khoá dòng mã
  const usedByMe = await db.voucherRedemption.count({ where: { voucherId: voucher.id, userId: params.userId } });
  if (usedByMe >= voucher.perUserLimit) {
    throw new ConflictError(PER_USER_LIMIT_MESSAGE);
  }

  const discountAmount = computeDiscountAmount(
    {
      discountType: voucher.discountType,
      discountValue: Number(voucher.discountValue),
      maxDiscount: voucher.maxDiscount === null ? null : Number(voucher.maxDiscount),
    },
    params.subtotal,
  );

  return { voucher, discountAmount };
}

/**
 * Áp dụng thật: gọi SAU KHI đơn đã tạo xong (cần `orderCode`), trong CÙNG transaction với
 * `order.service.ts`. Tăng `usageCount` bằng `updateMany` có điều kiện tồn tại ngay trong `WHERE` —
 * cùng idiom chống race đã dùng để trừ kho: hai người dùng nốt lượt cuối cùng không thể cùng thành công.
 *
 * Giới hạn MỖI NGƯỜI (`perUserLimit`) không viết được thành điều kiện trên dòng mã (phải đếm bảng khác), nên làm
 * nguyên tử bằng khoá: bước tăng `usageCount` khoá dòng mã tới hết transaction, mọi lượt dùng (và hoàn lượt khi huỷ đơn)
 * của cùng mã phải xếp hàng sau nó. Đếm lại lượt đã dùng NGAY SAU khi giữ khoá, bằng đọc có khoá: cùng một người đặt
 * hai đơn cùng lúc thì đơn sau chờ đơn trước commit, đếm ra đủ lượt → 409, cả transaction (kể cả `usageCount` vừa
 * tăng) bị huỷ.
 */
export async function redeemVoucher(
  db: Db,
  params: {
    voucher: Pick<Voucher, "id" | "usageLimit" | "perUserLimit">;
    userId: string;
    orderCode: string;
    discountAmount: number;
  },
): Promise<void> {
  const updated = await db.voucher.updateMany({
    where: {
      id: params.voucher.id,
      ...(params.voucher.usageLimit !== null ? { usageCount: { lt: params.voucher.usageLimit } } : {}),
    },
    data: { usageCount: { increment: 1 } },
  });
  if (updated.count === 0) {
    throw new ConflictError("Mã giảm giá vừa hết lượt sử dụng. Vui lòng bỏ mã và thử lại.");
  }

  if ((await countRedemptionsLocked(db, params.voucher.id, params.userId)) >= params.voucher.perUserLimit) {
    throw new ConflictError(PER_USER_LIMIT_MESSAGE);
  }

  await db.voucherRedemption.create({
    data: {
      voucherId: params.voucher.id,
      userId: params.userId,
      // Cột này khai @db.VarChar(30) và không có @relation — đúng độ dài orderCode (khác id dạng cuid),
      // lưu mã đơn cho tiện tra soát bằng mắt, khớp cách Order tự sinh orderCode để khách đọc được
      orderId: params.orderCode,
      discountApplied: params.discountAmount,
    },
  });
}

/** Route-facing: xem trước số tiền được giảm trước khi đặt hàng thật */
export async function previewVoucher(userId: string, code: string, subtotal: number): Promise<VoucherPreviewResultDto> {
  const { voucher, discountAmount } = await validateVoucherForOrder(prisma, { code, subtotal, userId });
  return { voucher: toVoucherDto(voucher), discountAmount };
}
