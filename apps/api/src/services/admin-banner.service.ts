import { prisma, type UserRole } from "@pczone/db";
import { toAdminBannerDto } from "../mappers/banner.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { AdminBannerDto, AdminBannerInput } from "../types/dto.js";
import { logAdminAction } from "./audit-log.service.js";

export interface AdminActor {
  userId: string;
  role: UserRole;
}

/** `GET /api/admin/banners` — mọi trạng thái (nháp + đã đăng), theo đúng thứ tự hiển thị công khai */
export async function listBannersForAdmin(): Promise<AdminBannerDto[]> {
  const rows = await prisma.banner.findMany({ orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }] });
  return rows.map(toAdminBannerDto);
}

export async function getBannerForAdmin(id: string): Promise<AdminBannerDto> {
  const banner = await prisma.banner.findUnique({ where: { id } });
  if (!banner) throw new NotFoundError("Không tìm thấy banner");
  return toAdminBannerDto(banner);
}

function assertValidInput(input: AdminBannerInput): void {
  if (input.startsAt && input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
    throw new ConflictError("Ngày kết thúc phải sau ngày bắt đầu");
  }
}

export async function createBanner(input: AdminBannerInput, admin: AdminActor): Promise<AdminBannerDto> {
  assertValidInput(input);

  const banner = await prisma.$transaction(async (tx) => {
    const created = await tx.banner.create({
      data: {
        title: input.title,
        subtitle: input.subtitle,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl,
        displayOrder: input.displayOrder,
        status: input.status,
        startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
        endsAt: input.endsAt ? new Date(input.endsAt) : undefined,
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "banner.created",
      targetType: "Banner",
      targetId: created.id,
      metadata: { title: created.title, status: created.status },
    });
    return created;
  });

  return toAdminBannerDto(banner);
}

export async function updateBanner(id: string, input: AdminBannerInput, admin: AdminActor): Promise<AdminBannerDto> {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Không tìm thấy banner");
  assertValidInput(input);

  const banner = await prisma.$transaction(async (tx) => {
    const updated = await tx.banner.update({
      where: { id },
      data: {
        title: input.title,
        subtitle: input.subtitle,
        imageUrl: input.imageUrl,
        linkUrl: input.linkUrl,
        displayOrder: input.displayOrder,
        status: input.status,
        startsAt: input.startsAt ? new Date(input.startsAt) : null,
        endsAt: input.endsAt ? new Date(input.endsAt) : null,
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "banner.updated",
      targetType: "Banner",
      targetId: id,
      metadata: { title: updated.title, status: updated.status },
    });
    return updated;
  });

  return toAdminBannerDto(banner);
}

/** Banner không có bảng con nào tham chiếu tới (khác Voucher/VoucherRedemption) — xoá thẳng, không cần chặn */
export async function deleteBanner(id: string, admin: AdminActor): Promise<void> {
  const existing = await prisma.banner.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Không tìm thấy banner");

  await prisma.$transaction(async (tx) => {
    await tx.banner.delete({ where: { id } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "banner.deleted",
      targetType: "Banner",
      targetId: id,
      metadata: { title: existing.title },
    });
  });
}
