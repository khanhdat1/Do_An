import bcrypt from "bcryptjs";
import { prisma, type Prisma, type UserRole } from "@pczone/db";
import { orderSummaryInclude, toAdminOrderSummaryDto } from "../mappers/order.mapper.js";
import { BadRequestError, ConflictError, NotFoundError } from "../middleware/errors.js";
import type {
  AdminCustomerAddressDto,
  AdminCustomerDetailDto,
  AdminCustomerListDto,
  AdminCustomerPasswordResetDto,
  AdminCustomerSummaryDto,
  AdminOrderSummaryDto,
  Paginated,
} from "../types/dto.js";
import { customerCode, deleteBlockReason, generateTemporaryPassword, OPEN_ORDER_STATUSES } from "../utils/admin-customer.js";
import { isUniqueViolation } from "../utils/prisma-errors.js";
import { revokeSessionsOf } from "../utils/session-revocation.js";
import { logAdminAction } from "./audit-log.service.js";
import { BCRYPT_COST } from "./auth.service.js";
import { recomputeProductRating } from "./review.service.js";

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
  lockReason: true,
  lockedAt: true,
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
    code: customerCode(row.id),
    fullName: row.fullName,
    email: row.email,
    phone: row.phone ?? undefined,
    isActive: row.isActive,
    lockReason: row.isActive ? undefined : (row.lockReason ?? undefined),
    lockedAt: row.isActive ? undefined : row.lockedAt?.toISOString(),
    orderCount: row.orderCount,
    totalSpent: row.totalSpent,
    createdAt: row.createdAt.toISOString(),
    lastLoginAt: row.lastLoginAt?.toISOString(),
  };
}

function buildCustomerWhere(filters: AdminCustomerFilters): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { role: "CUSTOMER" };
  if (filters.locked !== undefined) where.isActive = !filters.locked;
  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [{ fullName: { contains: term } }, { email: { contains: term } }, { phone: { contains: term } }];
  }
  return where;
}

/**
 * `GET /api/admin/customers` — mặc định mọi khách hàng (đang hoạt động + đã khoá), mới đăng ký trước. Kèm số tài khoản
 * theo trạng thái với CÙNG ô tìm kiếm, để các tab "Tất cả / Đang hoạt động / Đã khoá" hiện đúng con số.
 */
export async function listCustomersForAdmin(
  filters: AdminCustomerFilters,
  page: number,
  pageSize: number,
): Promise<AdminCustomerListDto> {
  const where = buildCustomerWhere(filters);
  const searchOnly = buildCustomerWhere({ search: filters.search });

  const [total, rows, all, active] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: CUSTOMER_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.user.count({ where: searchOnly }),
    prisma.user.count({ where: { ...searchOnly, isActive: true } }),
  ]);

  const withStats = await attachOrderStats(rows);
  return {
    items: withStats.map(toSummaryDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
    counts: { all, active, locked: all - active },
  };
}

const EXPORT_ROW_LIMIT = 10_000;

/** Dùng cho xuất báo cáo — TẤT CẢ khách hàng khớp bộ lọc, không phân trang (khác `listCustomersForAdmin`, luôn phân trang) */
export async function listAllCustomersForAdmin(filters: AdminCustomerFilters): Promise<AdminCustomerSummaryDto[]> {
  const rows = await prisma.user.findMany({
    where: buildCustomerWhere(filters),
    select: CUSTOMER_SELECT,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: EXPORT_ROW_LIMIT,
  });
  const withStats = await attachOrderStats(rows);
  return withStats.map(toSummaryDto);
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

const ADDRESS_SELECT = {
  id: true,
  recipientName: true,
  phone: true,
  province: true,
  district: true,
  ward: true,
  streetAddress: true,
} satisfies Prisma.AddressSelect;

/** Địa chỉ mặc định; khách chưa đánh dấu mặc định thì lấy địa chỉ mới nhất — đúng cách trang thanh toán chọn sẵn */
function findDefaultAddress(db: Prisma.TransactionClient, userId: string) {
  return db.address.findFirst({
    where: { userId },
    select: ADDRESS_SELECT,
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}

export async function getCustomerForAdmin(id: string): Promise<AdminCustomerDetailDto> {
  const user = await findCustomerOrThrow(id);
  const [[withStats], address] = await Promise.all([attachOrderStats([user]), findDefaultAddress(prisma, id)]);
  const defaultAddress: AdminCustomerAddressDto | undefined = address
    ? {
        recipientName: address.recipientName,
        phone: address.phone,
        province: address.province,
        district: address.district,
        ward: address.ward,
        streetAddress: address.streetAddress,
      }
    : undefined;
  return { ...toSummaryDto(withStats), emailVerifiedAt: user.emailVerifiedAt?.toISOString(), defaultAddress };
}

export interface AdminCustomerUpdateInput {
  fullName: string;
  email: string;
  phone?: string;
  /** Không gửi = giữ nguyên sổ địa chỉ */
  address?: { province: string; district: string; ward: string; streetAddress: string };
}

/**
 * `PATCH /api/admin/customers/:id` — quản trị sửa họ tên, email, số điện thoại và địa chỉ mặc định của khách. Đổi email
 * thì email mới coi như CHƯA xác minh (khách phải xác minh lại). Địa chỉ: sửa địa chỉ mặc định nếu đã có, chưa có thì tạo
 * mới làm mặc định (người nhận = họ tên, số điện thoại = số của khách). Nhật ký ghi đúng các trường đã đổi.
 */
export async function updateCustomerForAdmin(
  id: string,
  input: AdminCustomerUpdateInput,
  admin: AdminActor,
): Promise<AdminCustomerDetailDto> {
  const existing = await findCustomerOrThrow(id);

  try {
    await prisma.$transaction(async (tx) => {
      if (input.email !== existing.email) {
        const taken = await tx.user.findFirst({ where: { email: input.email, id: { not: id } }, select: { id: true } });
        if (taken) throw new ConflictError("Email này đã được tài khoản khác sử dụng");
      }

      const emailChanged = input.email !== existing.email;
      await tx.user.update({
        where: { id },
        data: {
          fullName: input.fullName,
          email: input.email,
          phone: input.phone ?? null,
          ...(emailChanged ? { emailVerifiedAt: null } : {}),
        },
      });

      const before: Record<string, string | null> = {};
      const after: Record<string, string | null> = {};
      for (const key of ["fullName", "email", "phone"] as const) {
        const oldValue = existing[key] ?? undefined;
        const newValue = input[key] ?? undefined;
        if (oldValue !== newValue) {
          before[key] = oldValue ?? null;
          after[key] = newValue ?? null;
        }
      }

      if (input.address) {
        const current = await findDefaultAddress(tx, id);
        const phone = input.phone ?? current?.phone;
        if (!phone) throw new BadRequestError("Cần số điện thoại của khách để lưu địa chỉ giao hàng");
        if (current) {
          await tx.address.update({ where: { id: current.id }, data: { ...input.address, isDefault: true } });
        } else {
          await tx.address.create({
            data: { userId: id, recipientName: input.fullName, phone, ...input.address, isDefault: true },
          });
        }
        const oldAddress = current ? [current.streetAddress, current.ward, current.district, current.province].join(", ") : null;
        const newAddress = [input.address.streetAddress, input.address.ward, input.address.district, input.address.province].join(", ");
        if (oldAddress !== newAddress) {
          before.address = oldAddress;
          after.address = newAddress;
        }
      }

      await logAdminAction(tx, {
        actorId: admin.userId,
        actorRole: admin.role,
        action: "customer.updated",
        targetType: "User",
        targetId: id,
        metadata: { email: existing.email, before, after },
      });
    });
  } catch (error) {
    // Hai quản trị cùng đổi sang một email: lượt sau vướng ràng buộc duy nhất của cột email
    if (isUniqueViolation(error)) throw new ConflictError("Email này đã được tài khoản khác sử dụng");
    throw error;
  }

  return getCustomerForAdmin(id);
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
 * Khoá/mở khoá tài khoản khách hàng. Khoá bắt buộc có lý do (kiểm ở route), lưu vào `User.lockReason` để trang quản trị
 * hiện lại. Khoá xong khách bị đăng xuất NGAY: xoá mọi refresh token (không làm mới phiên được nữa — `auth.service.ts`
 * cũng từ chối tài khoản `isActive=false` ở đăng nhập và làm mới phiên) và thu hồi mọi access token đang cầm
 * (`revokeSessionsOf`), không phải chờ token hết hạn như trước.
 */
export async function setCustomerLock(
  id: string,
  isActive: boolean,
  reason: string | undefined,
  admin: AdminActor,
): Promise<AdminCustomerDetailDto> {
  const existing = await findCustomerOrThrow(id);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: isActive ? { isActive, lockReason: null, lockedAt: null } : { isActive, lockReason: reason ?? null, lockedAt: new Date() },
    });
    if (!isActive) await tx.refreshToken.deleteMany({ where: { userId: id } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: isActive ? "customer.unlocked" : "customer.locked",
      targetType: "User",
      targetId: id,
      metadata: { email: existing.email, reason: isActive ? existing.lockReason ?? undefined : reason },
    });
  });
  if (!isActive) revokeSessionsOf(id);

  return getCustomerForAdmin(id);
}

/**
 * `POST /api/admin/customers/:id/reset-password` — quản trị đặt mật khẩu mới cho khách (khách quên mật khẩu mà không
 * nhận được email, hoặc tài khoản bị lộ). `password` trống thì hệ thống sinh mật khẩu tạm và trả về ĐÚNG MỘT LẦN trong
 * response — không lưu, không ghi nhật ký. Giống "quên mật khẩu": khách bị đăng xuất khỏi mọi thiết bị, link đặt lại
 * mật khẩu còn hạn (nếu có) bị huỷ.
 */
export async function resetCustomerPassword(
  id: string,
  password: string | undefined,
  admin: AdminActor,
): Promise<AdminCustomerPasswordResetDto> {
  const existing = await findCustomerOrThrow(id);
  const generatedPassword = password ? undefined : generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(password ?? (generatedPassword as string), BCRYPT_COST);

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { passwordHash, hasPassword: true } });
    await tx.refreshToken.deleteMany({ where: { userId: id } });
    await tx.passwordResetToken.deleteMany({ where: { userId: id } });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "customer.password_reset",
      targetType: "User",
      targetId: id,
      metadata: { email: existing.email, mode: generatedPassword ? "random" : "manual" },
    });
  });
  revokeSessionsOf(id);

  return { generatedPassword };
}

/**
 * `DELETE /api/admin/customers/:id` — xoá hẳn tài khoản khách hàng. Từ chối (409) khi khách còn đơn chưa xong
 * (`OPEN_ORDER_STATUSES`). Theo ràng buộc khoá ngoại của schema:
 * - đơn hàng GIỮ LẠI (cột `userId` thành NULL) — đơn đã chụp tên, địa chỉ, giá lúc đặt nên doanh thu và lịch sử đơn
 *   không đổi; hội thoại AI, cấu hình Build PC, nhật ký tìm kiếm cũng giữ lại nhưng không còn gắn với ai;
 * - sổ địa chỉ, giỏ hàng, yêu thích, đánh giá, lượt dùng mã giảm giá, liên kết mạng xã hội, phiên đăng nhập bị xoá theo.
 * Đánh giá đã duyệt bị xoá nên điểm trung bình của các sản phẩm đó được tính lại trong cùng transaction.
 */
export async function deleteCustomerForAdmin(id: string, admin: AdminActor): Promise<void> {
  const existing = await findCustomerOrThrow(id);

  await prisma.$transaction(async (tx) => {
    const [openOrders, orderCount, reviewed] = await Promise.all([
      tx.order.count({ where: { userId: id, status: { in: [...OPEN_ORDER_STATUSES] } } }),
      tx.order.count({ where: { userId: id } }),
      tx.review.findMany({ where: { userId: id, isApproved: true }, select: { productId: true }, distinct: ["productId"] }),
    ]);
    const blocked = deleteBlockReason(openOrders);
    if (blocked) throw new ConflictError(blocked);

    await tx.user.delete({ where: { id } });
    for (const { productId } of reviewed) await recomputeProductRating(tx, productId);

    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "customer.deleted",
      targetType: "User",
      targetId: id,
      metadata: { email: existing.email, fullName: existing.fullName, orderCount, approvedReviewProducts: reviewed.length },
    });
  });
  revokeSessionsOf(id);
}
