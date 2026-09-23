import { prisma, type Prisma, type UserRole } from "@pczone/db";
import { toAdminVoucherDto } from "../mappers/voucher.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { AdminVoucherDto, AdminVoucherInput, Paginated } from "../types/dto.js";
import { logAdminAction } from "./audit-log.service.js";

export interface AdminActor {
  userId: string;
  role: UserRole;
}

export interface AdminVoucherFilters {
  search?: string;
  /** true = chỉ mã đang bật, false = chỉ mã đã tắt, để trống = tất cả */
  active?: boolean;
}

/** `GET /api/admin/vouchers` — mặc định mọi mã (bật + tắt), mới tạo trước */
export async function listVouchersForAdmin(
  filters: AdminVoucherFilters,
  page: number,
  pageSize: number,
): Promise<Paginated<AdminVoucherDto>> {
  const where: Prisma.VoucherWhereInput = {};
  if (filters.active !== undefined) where.isActive = filters.active;
  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [{ code: { contains: term } }, { name: { contains: term } }];
  }

  const [total, rows] = await Promise.all([
    prisma.voucher.count({ where }),
    prisma.voucher.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toAdminVoucherDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getVoucherForAdmin(id: string): Promise<AdminVoucherDto> {
  const voucher = await prisma.voucher.findUnique({ where: { id } });
  if (!voucher) throw new NotFoundError("Không tìm thấy mã giảm giá");
  return toAdminVoucherDto(voucher);
}

async function assertCodeAvailable(code: string, excludeId?: string): Promise<void> {
  const existing = await prisma.voucher.findUnique({ where: { code }, select: { id: true } });
  if (existing && existing.id !== excludeId) throw new ConflictError(`Mã "${code}" đã tồn tại`);
}

function assertValidInput(input: AdminVoucherInput): void {
  if (new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new ConflictError("Ngày kết thúc phải sau ngày bắt đầu");
  }
  if (input.discountType === "PERCENT" && (input.discountValue <= 0 || input.discountValue > 100)) {
    throw new ConflictError("Mã giảm theo % phải trong khoảng 1-100");
  }
  if (input.discountType === "FIXED" && input.discountValue <= 0) {
    throw new ConflictError("Số tiền giảm phải lớn hơn 0");
  }
}

export async function createVoucher(input: AdminVoucherInput, admin: AdminActor): Promise<AdminVoucherDto> {
  const code = input.code.trim().toUpperCase();
  assertValidInput(input);
  await assertCodeAvailable(code);

  const voucher = await prisma.$transaction(async (tx) => {
    const created = await tx.voucher.create({
      data: {
        code,
        name: input.name,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderAmount: input.minOrderAmount,
        maxDiscount: input.maxDiscount,
        usageLimit: input.usageLimit,
        perUserLimit: input.perUserLimit,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        isActive: input.isActive,
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "voucher.created",
      targetType: "Voucher",
      targetId: created.id,
      metadata: { code: created.code, name: created.name },
    });
    return created;
  });

  return toAdminVoucherDto(voucher);
}

export async function updateVoucher(id: string, input: AdminVoucherInput, admin: AdminActor): Promise<AdminVoucherDto> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Không tìm thấy mã giảm giá");

  const code = input.code.trim().toUpperCase();
  assertValidInput(input);
  await assertCodeAvailable(code, id);

  const voucher = await prisma.$transaction(async (tx) => {
    const updated = await tx.voucher.update({
      where: { id },
      data: {
        code,
        name: input.name,
        description: input.description,
        discountType: input.discountType,
        discountValue: input.discountValue,
        minOrderAmount: input.minOrderAmount,
        maxDiscount: input.maxDiscount,
        usageLimit: input.usageLimit,
        perUserLimit: input.perUserLimit,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        isActive: input.isActive,
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "voucher.updated",
      targetType: "Voucher",
      targetId: id,
      metadata: { code: updated.code, isActive: updated.isActive },
    });
    return updated;
  });

  return toAdminVoucherDto(voucher);
}

/**
 * Chỉ cho xoá mã CHƯA từng được dùng (`usageCount === 0`) — `VoucherRedemption` có `onDelete: Cascade`
 * lên `Voucher`, xoá một mã đã có người dùng sẽ xoá luôn lịch sử đã giảm giá bao nhiêu cho đơn nào, mất
 * dấu vết đối soát. Mã đã dùng thì tắt (`isActive=false`) qua form sửa thay vì xoá — không phá dữ liệu.
 */
export async function deleteVoucher(id: string, admin: AdminActor): Promise<void> {
  const existing = await prisma.voucher.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Không tìm thấy mã giảm giá");
  if (existing.usageCount > 0) {
    throw new ConflictError("Mã đã được sử dụng — hãy tắt mã (bỏ chọn \"đang bật\") thay vì xoá, để giữ lịch sử đối soát");
  }

  await prisma.$transaction(async (tx) => {
    await tx.voucher.delete({ where: { id } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "voucher.deleted",
      targetType: "Voucher",
      targetId: id,
      metadata: { code: existing.code },
    });
  });
}
