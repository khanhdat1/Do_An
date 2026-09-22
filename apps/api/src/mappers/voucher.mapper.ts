import type { Voucher } from "@pczone/db";
import type { VoucherDto } from "../types/dto.js";

export function toVoucherDto(voucher: Voucher): VoucherDto {
  return {
    code: voucher.code,
    name: voucher.name,
    description: voucher.description ?? undefined,
    discountType: voucher.discountType,
    discountValue: Number(voucher.discountValue),
    maxDiscount: voucher.maxDiscount === null ? undefined : Number(voucher.maxDiscount),
    minOrderAmount: voucher.minOrderAmount === null ? undefined : Number(voucher.minOrderAmount),
    endsAt: voucher.endsAt.toISOString(),
  };
}
