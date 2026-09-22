import { prisma, type Prisma } from "@pczone/db";
import { toAddressDto } from "../mappers/address.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import type { AddressDto } from "../types/dto.js";
import { MAX_ADDRESSES } from "../utils/limits.js";

/**
 * `Prisma.TransactionClient` là kiểu con của `PrismaClient` (thiếu vài hàm quản lý kết nối không
 * dùng trong service) nên truyền thẳng `prisma` singleton vào tham số kiểu này vẫn khớp — nhờ vậy
 * các hàm dưới đây gọi độc lập được (route thường) hoặc lồng vào transaction của nơi khác
 * (order.service tạo địa chỉ mới ngay trong transaction tạo đơn).
 */
type Db = Prisma.TransactionClient;

export interface AddressInput {
  recipientName: string;
  phone: string;
  province: string;
  district: string;
  ward: string;
  streetAddress: string;
  note?: string;
}

export async function listAddresses(userId: string): Promise<AddressDto[]> {
  const rows = await prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
  return rows.map(toAddressDto);
}

/**
 * Tạo địa chỉ mới. Địa chỉ đầu tiên của một tài khoản luôn tự thành mặc định — nếu không, sổ địa chỉ
 * rỗng sẽ không có địa chỉ mặc định nào để bước đặt hàng gợi ý sẵn.
 */
export async function createAddress(
  db: Db,
  userId: string,
  input: AddressInput,
  makeDefault = false,
): Promise<AddressDto> {
  const count = await db.address.count({ where: { userId } });
  if (count >= MAX_ADDRESSES) {
    throw new ConflictError(`Sổ địa chỉ chỉ lưu được tối đa ${MAX_ADDRESSES} địa chỉ`);
  }

  const isDefault = makeDefault || count === 0;
  if (isDefault) {
    await db.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
  }

  const row = await db.address.create({ data: { userId, ...input, isDefault } });
  return toAddressDto(row);
}

export async function updateAddress(
  userId: string,
  addressId: string,
  input: Partial<AddressInput>,
): Promise<AddressDto> {
  const result = await prisma.address.updateMany({ where: { id: addressId, userId }, data: input });
  if (result.count === 0) throw new NotFoundError("Không tìm thấy địa chỉ");

  const row = await prisma.address.findUniqueOrThrow({ where: { id: addressId } });
  return toAddressDto(row);
}

export async function setDefaultAddress(userId: string, addressId: string): Promise<AddressDto> {
  return prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: addressId, userId } });
    if (!address) throw new NotFoundError("Không tìm thấy địa chỉ");

    await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    const updated = await tx.address.update({ where: { id: addressId }, data: { isDefault: true } });
    return toAddressDto(updated);
  });
}

/** Xoá một địa chỉ; nếu đó là địa chỉ mặc định và còn địa chỉ khác, chuyển mặc định sang địa chỉ mới nhất còn lại */
export async function deleteAddress(userId: string, addressId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const address = await tx.address.findFirst({ where: { id: addressId, userId } });
    // Xoá cái không còn tồn tại thì coi như đã xong, khớp cách removeItem của giỏ hàng xử lý
    if (!address) return;

    await tx.address.delete({ where: { id: addressId } });

    if (address.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: "desc" } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}
