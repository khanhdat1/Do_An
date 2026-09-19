import { prisma, ProductStatus } from "@pczone/db";
import type { CategoryDto } from "../types/dto.js";
import { formatPrice } from "../utils/format.js";

/**
 * Dòng phụ dưới tên danh mục ở trang chủ.
 * Ưu tiên `description` do admin nhập; nếu chưa có thì tự sinh "Từ x.xxx.xxxđ"
 * dựa trên giá thấp nhất đang bán.
 */
function buildCaption(description: string | null, minPrice: number | null): string {
  if (description) return description;
  if (minPrice && minPrice > 0) return `Từ ${formatPrice(minPrice)}`;
  return "Đang cập nhật";
}

export async function listCategories(): Promise<CategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: { _count: { select: { products: true } } },
      },
      _count: { select: { products: true } },
    },
  });

  // Giá thấp nhất của từng danh mục, gộp trong một truy vấn thay vì N+1
  const minPrices = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { status: ProductStatus.ACTIVE },
    _min: { sellingPrice: true },
  });
  const minPriceByCategory = new Map(
    minPrices.map((row) => [row.categoryId, Number(row._min.sellingPrice ?? 0)]),
  );

  return categories
    .filter((category) => category.parentId === null)
    .map((category) => ({
      slug: category.slug,
      name: category.name,
      icon: category.icon ?? "Cpu",
      caption: buildCaption(
        category.description,
        minPriceByCategory.get(category.id) ?? null,
      ),
      productCount: category._count.products,
      children: category.children.map((child) => ({
        slug: child.slug,
        name: child.name,
        icon: child.icon ?? "Cpu",
        caption: buildCaption(
          child.description,
          minPriceByCategory.get(child.id) ?? null,
        ),
        productCount: child._count.products,
      })),
    }));
}

/**
 * 6 danh mục hiện ở lưới "Danh mục nổi bật" trang chủ:
 * lấy danh mục lá, ưu tiên theo sortOrder.
 */
export async function getFeaturedCategories(limit: number): Promise<CategoryDto[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true, children: { none: {} } },
    orderBy: { sortOrder: "asc" },
    take: limit,
    include: { _count: { select: { products: true } } },
  });

  const minPrices = await prisma.product.groupBy({
    by: ["categoryId"],
    where: { status: ProductStatus.ACTIVE },
    _min: { sellingPrice: true },
  });
  const minPriceByCategory = new Map(
    minPrices.map((row) => [row.categoryId, Number(row._min.sellingPrice ?? 0)]),
  );

  return categories.map((category) => ({
    slug: category.slug,
    name: category.name,
    icon: category.icon ?? "Cpu",
    caption: buildCaption(
      category.description,
      minPriceByCategory.get(category.id) ?? null,
    ),
    productCount: category._count.products,
  }));
}
