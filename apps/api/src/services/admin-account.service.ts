import bcrypt from "bcryptjs";
import { prisma, type Prisma, type UserRole } from "@pczone/db";
import { BCRYPT_COST } from "./auth.service.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { AdminAccountDto, AdminAccountInput } from "../types/dto.js";
import { logAdminAction } from "./audit-log.service.js";

export interface AdminActor {
  userId: string;
  role: UserRole;
}

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  isActive: true,
  totpEnabledAt: true,
  lastLoginAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type AccountRow = Prisma.UserGetPayload<{ select: typeof ACCOUNT_SELECT }>;

function toAdminAccountDto(row: AccountRow): AdminAccountDto {
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    role: row.role,
    isActive: row.isActive,
    totpEnabled: row.totpEnabledAt !== null,
    lastLoginAt: row.lastLoginAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
}

/** `GET /api/admin/accounts` — mọi tài khoản KHÔNG PHẢI khách hàng (kể cả role ADMIN/STAFF cũ còn sót lại), mới tạo trước */
export async function listAdminAccounts(): Promise<AdminAccountDto[]> {
  const rows = await prisma.user.findMany({
    where: { role: { not: "CUSTOMER" } },
    select: ACCOUNT_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
  });
  return rows.map(toAdminAccountDto);
}

async function findAccountOrThrow(id: string): Promise<AccountRow> {
  const row = await prisma.user.findFirst({ where: { id, role: { not: "CUSTOMER" } }, select: ACCOUNT_SELECT });
  if (!row) throw new NotFoundError("Không tìm thấy tài khoản quản trị");
  return row;
}

export async function getAdminAccount(id: string): Promise<AdminAccountDto> {
  return toAdminAccountDto(await findAccountOrThrow(id));
}

async function assertEmailAvailable(email: string, excludeId?: string): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing && existing.id !== excludeId) throw new ConflictError(`Email "${email}" đã được dùng cho tài khoản khác`);
}

export async function createAdminAccount(input: AdminAccountInput, admin: AdminActor): Promise<AdminAccountDto> {
  const email = input.email.trim().toLowerCase();
  if (!input.role) {
    throw new ConflictError("Cần chọn vai trò cho tài khoản mới");
  }
  if (!input.password || input.password.length < 8) {
    throw new ConflictError("Mật khẩu phải có ít nhất 8 ký tự");
  }
  await assertEmailAvailable(email);

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const account = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: { email, passwordHash, fullName: input.fullName, role: input.role },
      select: ACCOUNT_SELECT,
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "admin_account.created",
      targetType: "User",
      targetId: created.id,
      metadata: { email: created.email, role: created.role },
    });
    return created;
  });

  return toAdminAccountDto(account);
}

/**
 * Sửa email/tên, đổi mật khẩu (chỉ khi `input.password` có giá trị). `input.role` để trống = GIỮ
 * NGUYÊN vai trò hiện tại (quan trọng cho tài khoản đang ở vai trò cũ ADMIN/STAFF — sửa tên/khoá tài
 * khoản đó không bị ép phải chọn vai trò mới trước). Tự đổi vai trò của CHÍNH MÌNH bị chặn — tránh
 * một OWNER lỡ tay hạ quyền chính mình rồi không ai còn sửa lại được.
 */
export async function updateAdminAccount(id: string, input: AdminAccountInput, admin: AdminActor): Promise<AdminAccountDto> {
  const existing = await findAccountOrThrow(id);
  if (id === admin.userId && input.role !== undefined && input.role !== existing.role) {
    throw new ConflictError("Không thể tự đổi vai trò của chính mình — nhờ một OWNER khác thực hiện");
  }

  const email = input.email.trim().toLowerCase();
  await assertEmailAvailable(email, id);

  const passwordHash = input.password ? await bcrypt.hash(input.password, BCRYPT_COST) : undefined;
  if (input.password && input.password.length < 8) {
    throw new ConflictError("Mật khẩu phải có ít nhất 8 ký tự");
  }

  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { email, fullName: input.fullName, role: input.role, ...(passwordHash ? { passwordHash } : {}) },
      select: ACCOUNT_SELECT,
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "admin_account.updated",
      targetType: "User",
      targetId: id,
      metadata: { email: updated.email, role: updated.role, passwordChanged: Boolean(passwordHash) },
    });
    return updated;
  });

  return toAdminAccountDto(account);
}

/** Khoá/mở khoá — tự khoá CHÍNH MÌNH bị chặn (không có cách tự mở khoá lại). */
export async function setAdminAccountLock(id: string, isActive: boolean, admin: AdminActor): Promise<AdminAccountDto> {
  const existing = await findAccountOrThrow(id);
  if (id === admin.userId && !isActive) {
    throw new ConflictError("Không thể tự khoá tài khoản của chính mình");
  }

  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({ where: { id }, data: { isActive }, select: ACCOUNT_SELECT });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: isActive ? "admin_account.unlocked" : "admin_account.locked",
      targetType: "User",
      targetId: id,
      metadata: { email: existing.email },
    });
    return updated;
  });

  return toAdminAccountDto(account);
}

/** Tắt 2FA HỘ — lối thoát khi một tài khoản mất thiết bị xác thực và tự mình không đăng nhập được nữa để tự tắt */
export async function forceDisableTwoFactor(id: string, admin: AdminActor): Promise<AdminAccountDto> {
  const existing = await findAccountOrThrow(id);

  const account = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { totpSecret: null, totpEnabledAt: null },
      select: ACCOUNT_SELECT,
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "admin_account.2fa_force_disabled",
      targetType: "User",
      targetId: id,
      metadata: { email: existing.email },
    });
    return updated;
  });

  return toAdminAccountDto(account);
}
