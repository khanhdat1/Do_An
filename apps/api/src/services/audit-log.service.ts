import type { Prisma, UserRole } from "@pczone/db";

type Db = Prisma.TransactionClient;

export interface AdminActionInput {
  actorId: string;
  actorRole: UserRole;
  action: string;
  targetType: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
  ip?: string;
}

/**
 * Ghi một dòng nhật ký thao tác quản trị. Gọi TƯỜNG MINH ở cuối mỗi service thao tác quan trọng,
 * trong CÙNG transaction với thao tác đó (giống cách OrderStatusHistory đã ghi changedBy) — không
 * dùng middleware ẩn, để mỗi loại thao tác tự quyết định metadata nào đáng ghi (trước/sau, lý do...).
 */
export async function logAdminAction(db: Db, input: AdminActionInput): Promise<void> {
  await db.adminAuditLog.create({
    data: {
      actorId: input.actorId,
      actorRole: input.actorRole,
      action: input.action,
      targetType: input.targetType,
      targetId: input.targetId,
      metadata: input.metadata,
      ip: input.ip,
    },
  });
}
