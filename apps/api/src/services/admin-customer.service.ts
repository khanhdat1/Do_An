import { prisma, type Prisma, type UserRole } from "@pczone/db";
import { orderSummaryInclude, toAdminOrderSummaryDto } from "../mappers/order.mapper.js";
import { NotFoundError } from "../middleware/errors.js";
import type { AdminCustomerDetailDto, AdminCustomerSummaryDto, AdminOrderSummaryDto, Paginated } from "../types/dto.js";
import { logAdminAction } from "./audit-log.service.js";

export interface AdminActor {
  userId: string;
  role: UserRole;
}

export interface AdminCustomerFilters {
  search?: string;
  /** true = chỉ tài khoản đã khoá, false = chỉ tài khoản đang hoạt động, để trống = tất cả */
  locked?: boolean;
}

const CUSTOMER_SELECT = {
  id: true,
  fullName: true,
  email: true,
  phone: true,
  isActive: true,
  createdAt: true,
  lastLoginAt: true,
} satisfies Prisma.UserSelect;

type CustomerRow = Prisma.UserGetPayload<{ select: typeof CUSTOMER_SELECT }>;

/**
 * Gộp orderCount (mọi trạng thái) + totalSpent (chỉ đơn đã thanh toán) cho ĐÚNG tập khách hàng truyền
 * vào — một truy vấn quét theo `userId IN (...)`, không aggregate toàn bảng đơn hàng mỗi lần tải trang.
 */
async function attachOrderStats<T extends { id: string }>(
  customers: T[],
): Promise<(T & { orderCount: number; totalSpent: number })[]> {
  if (customers.length === 0) return [];
  const ids = customers.map((customer) => customer.id);
  const orders = await prisma.order.findMany({
    where: { userId: { in: ids } },
    select: { userId: true, totalAmount: true, paymentStatus: true },
  });

  const countByUser = new Map<string, number>();
  const spentByUser = new Map<string, number>();
  for (const order of orders) {
    if (!order.userId) continue;
    countByUser.set(order.userId, (countByUser.get(order.userId) ?? 0) + 1);
    if (order.paymentStatus === "PAID") {
      spentByUser.set(order.userId, (spentByUser.get(order.userId) ?? 0) + Number(order.totalAmount));
    }
  }

  return customers.map((customer) => ({
    ...customer,
    orderCount: countByUser.get(customer.id) ?? 0,
    totalSpent: spentByUser.get(customer.id) ?? 0,
  }));
}

function toSummaryDto(row: CustomerRow & { orderCount: number; totalSpent: number }): AdminCustomerSummaryDto {
  return {
    id: row.id,
    fullName: row.fullName,
    email: row.email,
    phone: row.phone ?? undefined,
    isActive: row.isActive,
    orderCount: row.orderCount,
    totalSpent: row.totalSpent,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString(),
  };
}

/** `GET /api/admin/customers` — mặc định mọi khách hàng (đang hoạt động + đã khoá), mới đăng ký trước */
export async function listCustomersForAdmin(
  filters: AdminCustomerFilters,
  page: number,
  pageSize: number,
): Promise<Paginated<AdminCustomerSummaryDto>> {
  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (filters.locked !== undefined) where.isActive = !filters.locked;
  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [{ fullName: { contains: term } }, { email: { contains: term } }, { phone: { contains: term } }];
  }

  const [total, rows] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: CUSTOMER_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const withStats = await attachOrderStats(rows);
  return {
    items: withStats.map(toSummaryDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Chỉ tìm trong role CUSTOMER — trang này không được phép đọc/sửa tài khoản quản trị khác (đó là `admins:manage`, chưa làm) */
async function findCustomerOrThrow(id: string): Promise<CustomerRow & { emailVerifiedAt: Date | null }> {
  const user = await prisma.user.findFirst({
    where: { id, role: "CUSTOMER" },
    select: { ...CUSTOMER_SELECT, emailVerifiedAt: true },
  });
  if (!user) throw new NotFoundError("Không tìm thấy khách hàng");
  return user;
}

export async function getCustomerForAdmin(id: string): Promise<AdminCustomerDetailDto> {
  const user = await findCustomerOrThrow(id);
  const [withStats] = await attachOrderStats([user]);
  return { ...toSummaryDto(withStats), emailVerifiedAt: user.emailVerifiedAt?.toISOString() };
}

/** `GET /api/admin/customers/:id/orders` — lịch sử mua hàng, dùng lại đúng include/mapper của `GET /api/admin/orders` */
export async function listOrdersForCustomer(
  customerId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<AdminOrderSummaryDto>> {
  await findCustomerOrThrow(customerId);

  const where = { userId: customerId };
  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderSummaryInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toAdminOrderSummaryDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Khoá/mở khoá tài khoản khách hàng. `User.isActive=false` đã được `auth.service.ts` kiểm ở
 * đăng nhập VÀ ở làm mới phiên (refresh) — vì access token không tra DB mỗi request, một khách đang có
 * access token còn hạn (tối đa 15 phút) vẫn dùng được tới khi token đó hết hạn hoặc họ refresh, không bị
 * đá ra ngay lập tức. Đây là đánh đổi có chủ đích, không phải thiếu sót.
 */
export async function setCustomerLock(
  id: string,
  isActive: boolean,
  reason: string | undefined,
  admin: AdminActor,
): Promise<AdminCustomerDetailDto> {
  const existing = await findCustomerOrThrow(id);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { isActive } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: isActive ? "customer.unlocked" : "customer.locked",
      targetType: "User",
      targetId: id,
      metadata: { email: existing.email, reason },
    });
  });

  return getCustomerForAdmin(id);
}
