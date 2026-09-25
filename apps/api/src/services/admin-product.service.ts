import { prisma, type Prisma, type UserRole } from "@pczone/db";
import slugify from "slugify";
import {
  adminProductDetailInclude,
  adminProductSummaryInclude,
  toAdminProductDetailDto,
  toAdminProductSummaryDto,
} from "../mappers/product.mapper.js";
import { ConflictError, NotFoundError } from "../middleware/errors.js";
import { syncProductSpec } from "../pc-build/spec-store.js";
import type {
  AdminProductDetailDto,
  AdminProductInput,
  AdminProductSummaryDto,
  InventoryAdjustmentInput,
  InventoryTransactionDto,
  Paginated,
  ProductFormOptionsDto,
  ProductStatusDto,
} from "../types/dto.js";
import { logAdminAction } from "./audit-log.service.js";

export interface AdminActor {
  userId: string;
  role: UserRole;
}

export interface AdminProductFilters {
  status?: ProductStatusDto;
  /** Slug danh mục (chỉ khớp đúng danh mục đó, không gộp danh mục con — khác trang khách hàng) */
  category?: string;
  brand?: string;
  search?: string;
  lowStockOnly?: boolean;
}

function toSlug(name: string): string {
  return slugify(name, { lower: true, strict: true, locale: "vi" });
}

/** Thêm hậu tố -2, -3... nếu slug đã tồn tại, để đổi/đặt tên hai sản phẩm trùng tên vẫn ra slug khác nhau */
async function uniqueSlug(base: string, excludeId?: string): Promise<string> {
  const root = base || "san-pham";
  let candidate = root;
  let suffix = 2;
  for (;;) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate }, select: { id: true } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${root}-${suffix++}`;
  }
}

function buildProductWhere(filters: AdminProductFilters): Prisma.ProductWhereInput {
  const where: Prisma.ProductWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.category) where.category = { slug: filters.category };
  if (filters.brand) where.brand = { slug: filters.brand };
  if (filters.search) {
    const term = filters.search.trim();
    where.OR = [{ name: { contains: term } }, { sku: { contains: term } }];
  }
  if (filters.lowStockOnly) {
    // So sánh CỘT với CỘT (tồn kho vật lý so với ngưỡng của chính sản phẩm đó) — xem ghi chú ở mapper
    where.inventoryQuantity = { lte: prisma.product.fields.lowStockThreshold };
  }
  return where;
}

/** `GET /api/admin/products` — mặc định mọi trạng thái (DRAFT/ACTIVE/HIDDEN/DISCONTINUED), mới sửa trước */
export async function listProductsForAdmin(
  filters: AdminProductFilters,
  page: number,
  pageSize: number,
): Promise<Paginated<AdminProductSummaryDto>> {
  const where = buildProductWhere(filters);

  const [total, rows] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: adminProductSummaryInclude,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toAdminProductSummaryDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

const EXPORT_ROW_LIMIT = 10_000;

/** Dùng cho xuất báo cáo — TẤT CẢ sản phẩm khớp bộ lọc, không phân trang (khác `listProductsForAdmin`, luôn phân trang) */
export async function listAllProductsForAdmin(filters: AdminProductFilters): Promise<AdminProductSummaryDto[]> {
  const rows = await prisma.product.findMany({
    where: buildProductWhere(filters),
    include: adminProductSummaryInclude,
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: EXPORT_ROW_LIMIT,
  });
  return rows.map(toAdminProductSummaryDto);
}

/** Danh mục/hãng dạng phẳng cho ô chọn của form thêm/sửa sản phẩm — 22 danh mục, 62 hãng, không cần phân trang */
export async function getProductFormOptions(): Promise<ProductFormOptionsDto> {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, include: { parent: { select: { name: true } } } }),
    prisma.brand.findMany({ where: { isActive: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return {
    categories: categories.map((category) => ({
      id: category.id,
      name: category.name,
      path: category.parent ? `${category.parent.name} > ${category.name}` : category.name,
    })),
    brands,
  };
}

export async function getProductForAdmin(id: string): Promise<AdminProductDetailDto> {
  const product = await prisma.product.findUnique({ where: { id }, include: adminProductDetailInclude });
  if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");
  return toAdminProductDetailDto(product);
}

/** Sản phẩm đã lưu xong — đồng bộ thông số Build PC lỗi thì chỉ ghi log, không báo lưu thất bại */
async function syncSpecSafely(productId: string): Promise<void> {
  try {
    await syncProductSpec(productId);
  } catch (error) {
    console.error(`Không đồng bộ được thông số Build PC của sản phẩm ${productId}:`, error);
  }
}

async function assertSkuAvailable(sku: string, excludeId?: string): Promise<void> {
  const existing = await prisma.product.findUnique({ where: { sku }, select: { id: true } });
  if (existing && existing.id !== excludeId) throw new ConflictError(`Mã SKU "${sku}" đã được dùng cho sản phẩm khác`);
}

/** Sản phẩm mới luôn vào DRAFT — phải chuyển trạng thái tường minh (`updateProductStatus`) mới hiện ra ngoài */
export async function createProduct(input: AdminProductInput, admin: AdminActor): Promise<AdminProductDetailDto> {
  await assertSkuAvailable(input.sku);
  const slug = await uniqueSlug(toSlug(input.name));

  const product = await prisma.$transaction(async (tx) => {
    const created = await tx.product.create({
      data: {
        name: input.name,
        slug,
        sku: input.sku,
        categoryId: input.categoryId,
        brandId: input.brandId,
        sellingPrice: input.sellingPrice,
        costPrice: input.costPrice,
        originalPrice: input.originalPrice,
        shortDescription: input.shortDescription,
        description: input.description,
        warrantyMonths: input.warrantyMonths,
        lowStockThreshold: input.lowStockThreshold ?? 5,
        specifications: input.specifications as unknown as Prisma.InputJsonValue | undefined,
        status: "DRAFT",
        source: "MANUAL",
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "product.created",
      targetType: "Product",
      targetId: created.id,
      metadata: { name: created.name, sku: created.sku },
    });
    return created;
  });

  await syncSpecSafely(product.id);
  return getProductForAdmin(product.id);
}

export async function updateProduct(id: string, input: AdminProductInput, admin: AdminActor): Promise<AdminProductDetailDto> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Không tìm thấy sản phẩm");

  await assertSkuAvailable(input.sku, id);
  const slug = input.name === existing.name ? existing.slug : await uniqueSlug(toSlug(input.name), id);

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        slug,
        sku: input.sku,
        categoryId: input.categoryId,
        brandId: input.brandId,
        sellingPrice: input.sellingPrice,
        costPrice: input.costPrice,
        originalPrice: input.originalPrice,
        shortDescription: input.shortDescription,
        description: input.description,
        warrantyMonths: input.warrantyMonths,
        lowStockThreshold: input.lowStockThreshold ?? existing.lowStockThreshold,
        ...(input.specifications ? { specifications: input.specifications as unknown as Prisma.InputJsonValue } : {}),
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "product.updated",
      targetType: "Product",
      targetId: id,
      metadata: { name: input.name, sku: input.sku },
    });
  });

  await syncSpecSafely(id);
  return getProductForAdmin(id);
}

const STATUS_TRANSITION_NOTE: Record<ProductStatusDto, string> = {
  DRAFT: "Chuyển về nháp",
  ACTIVE: "Duyệt/kích hoạt bán",
  HIDDEN: "Tạm ẩn khỏi trang bán hàng",
  DISCONTINUED: "Ngừng kinh doanh (lưu trữ)",
};

export async function updateProductStatus(id: string, status: ProductStatusDto, admin: AdminActor): Promise<AdminProductDetailDto> {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("Không tìm thấy sản phẩm");

  await prisma.$transaction(async (tx) => {
    await tx.product.update({
      where: { id },
      data: { status, publishedAt: status === "ACTIVE" && !existing.publishedAt ? new Date() : undefined },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "product.status_changed",
      targetType: "Product",
      targetId: id,
      metadata: { from: existing.status, to: status, note: STATUS_TRANSITION_NOTE[status] },
    });
  });

  return getProductForAdmin(id);
}

function toInventoryTransactionDto(
  tx: Prisma.InventoryTransactionGetPayload<{ include: { createdBy: { select: { fullName: true } }; order: { select: { orderCode: true } } } }>,
): InventoryTransactionDto {
  return {
    id: tx.id,
    type: tx.type,
    quantityChange: tx.quantityChange,
    quantityAfter: tx.quantityAfter,
    unitCost: tx.unitCost ? Number(tx.unitCost) : undefined,
    note: tx.note ?? undefined,
    createdByName: tx.createdBy?.fullName,
    orderCode: tx.order?.orderCode,
    createdAt: tx.createdAt.toISOString(),
  };
}

export async function listInventoryTransactions(
  productId: string,
  page: number,
  pageSize: number,
): Promise<Paginated<InventoryTransactionDto>> {
  const where = { productId };
  const [total, rows] = await Promise.all([
    prisma.inventoryTransaction.count({ where }),
    prisma.inventoryTransaction.findMany({
      where,
      include: { createdBy: { select: { fullName: true } }, order: { select: { orderCode: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return {
    items: rows.map(toInventoryTransactionDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Nhập/xuất/điều chỉnh tồn kho thủ công. RETURN không có ở đây — luôn tự động theo đúng một đơn hàng
 * cụ thể (`returnOrder` ở Đợt 2), nhập tay một khoản RETURN không gắn đơn nào sẽ sai ý nghĩa dữ liệu.
 * Chặn kết quả âm ở CẢ BA loại — tồn kho không bao giờ được phép âm.
 */
export async function adjustInventory(
  productId: string,
  input: InventoryAdjustmentInput,
  admin: AdminActor,
): Promise<AdminProductDetailDto> {
  await prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");

    let quantityChange: number;
    let note = input.note;

    if (input.type === "IMPORT") {
      if (input.quantity <= 0) throw new ConflictError("Số lượng nhập phải lớn hơn 0");
      quantityChange = input.quantity;
    } else if (input.type === "EXPORT") {
      if (input.quantity <= 0) throw new ConflictError("Số lượng xuất phải lớn hơn 0");
      quantityChange = -input.quantity;
    } else {
      if (input.newQuantity < 0) throw new ConflictError("Số lượng kiểm kê không thể âm");
      quantityChange = input.newQuantity - product.inventoryQuantity;
      note = note || `Điều chỉnh theo kiểm kê thực tế: ${product.inventoryQuantity} → ${input.newQuantity}`;
    }

    const quantityAfter = product.inventoryQuantity + quantityChange;
    if (quantityAfter < 0) {
      throw new ConflictError(
        `Không thể xuất ${Math.abs(quantityChange)} — tồn kho hiện chỉ còn ${product.inventoryQuantity}`,
      );
    }

    await tx.product.update({ where: { id: productId }, data: { inventoryQuantity: quantityAfter } });
    await tx.inventoryTransaction.create({
      data: {
        productId,
        type: input.type,
        quantityChange,
        quantityAfter,
        unitCost: input.type === "IMPORT" ? input.unitCost : undefined,
        note,
        createdById: admin.userId,
      },
    });
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "product.inventory_adjusted",
      targetType: "Product",
      targetId: productId,
      metadata: { type: input.type, quantityChange, quantityAfter },
    });
  });

  return getProductForAdmin(productId);
}
