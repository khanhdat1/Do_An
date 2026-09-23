import type { Voucher } from "@pczone/db";
import type { AdminVoucherDto, VoucherDto } from "../types/dto.js";

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

/** Đầy đủ mọi cột cho khu quản trị — khác `toVoucherDto` (bản công khai, lược bớt cột quản lý nội bộ) */
export function toAdminVoucherDto(voucher: Voucher): AdminVoucherDto {
  return {
    id: voucher.id,
    code: voucher.code,
    name: voucher.name,
    description: voucher.description ?? undefined,
    discountType: voucher.discountType,
    discountValue: Number(voucher.discountValue),
    minOrderAmount: voucher.minOrderAmount === null ? undefined : Number(voucher.minOrderAmount),
    maxDiscount: voucher.maxDiscount === null ? undefined : Number(voucher.maxDiscount),
    usageLimit: voucher.usageLimit ?? undefined,
    usageCount: voucher.usageCount,
    perUserLimit: voucher.perUserLimit,
    startsAt: voucher.startsAt.toISOString(),
    endsAt: voucher.endsAt.toISOString(),
    isActive: voucher.isActive,
    createdAt: voucher.createdAt.toISOString(),
  };
}
