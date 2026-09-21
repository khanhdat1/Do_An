import { prisma, ProductStatus } from "@pczone/db";
import type { BrandFacetDto, CategoryDetailDto, CategoryDto } from "../types/dto.js";
import { formatPrice } from "../utils/format.js";
import { PUBLIC_FILTER } from "./product.service.js";

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
        include: { _count: { select: { products: { where: PUBLIC_FILTER } } } },
      },
      _count: { select: { products: { where: PUBLIC_FILTER } } },
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
 * Dữ liệu để dựng trang danh mục: đường dẫn, danh mục con, và các lựa chọn của bộ lọc.
 * Trả `null` khi slug không tồn tại hoặc danh mục đã bị ẩn (trang hiện 404).
 *
 * Bảng danh mục nhỏ (vài chục dòng) nên đọc cả bảng một lần rồi dựng cây trong bộ nhớ, thay
 * vì truy vấn lồng nhau theo số tầng: cây có mấy tầng cũng chỉ tốn một truy vấn.
 */
export async function getCategoryDetail(slug: string): Promise<CategoryDetailDto | null> {
  const all = await prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, slug: true, name: true, icon: true, parentId: true },
  });

  const current = all.find((category) => category.slug === slug);
  if (!current) return null;

  const childrenOf = new Map<string, typeof all>();
  for (const category of all) {
    if (category.parentId === null) continue;
    const siblings = childrenOf.get(category.parentId) ?? [];
    siblings.push(category);
    childrenOf.set(category.parentId, siblings);
  }

  /** Id của danh mục và mọi danh mục con cháu (có chặn vòng lặp nếu dữ liệu cha–con bị nhập sai) */
  const subtreeIds = (rootId: string): string[] => {
    const ids: string[] = [];
    const queue = [rootId];
    const seen = new Set<string>();
    while (queue.length > 0) {
      const id = queue.shift() as string;
      if (seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
      for (const child of childrenOf.get(id) ?? []) queue.push(child.id);
    }
    return ids;
  };

  const ids = subtreeIds(current.id);
  const where = { ...PUBLIC_FILTER, categoryId: { in: ids } };

  const [countsByCategory, brandGroups, price] = await Promise.all([
    prisma.product.groupBy({
      by: ["categoryId"],
      where: { ...PUBLIC_FILTER, categoryId: { in: all.map((category) => category.id) } },
      _count: { _all: true },
    }),
    prisma.product.groupBy({
      by: ["brandId"],
      where: { ...where, brandId: { not: null } },
      _count: { _all: true },
    }),
    prisma.product.aggregate({
      where,
      _min: { sellingPrice: true },
      _max: { sellingPrice: true },
    }),
  ]);

  const countById = new Map(countsByCategory.map((row) => [row.categoryId, row._count._all]));
  const countOf = (rootId: string) =>
    subtreeIds(rootId).reduce((sum, id) => sum + (countById.get(id) ?? 0), 0);

  const brandRows = await prisma.brand.findMany({
    where: { id: { in: brandGroups.flatMap((group) => (group.brandId ? [group.brandId] : [])) } },
    select: { id: true, slug: true, name: true },
  });
  const brandById = new Map(brandRows.map((brand) => [brand.id, brand]));

  const brands: BrandFacetDto[] = brandGroups
    .flatMap((group) => {
      const brand = group.brandId ? brandById.get(group.brandId) : undefined;
      return brand ? [{ slug: brand.slug, name: brand.name, count: group._count._all }] : [];
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));

  // Đường dẫn từ gốc xuống: đi ngược theo parentId, chặn vòng lặp như trên
  const byId = new Map(all.map((category) => [category.id, category]));
  const breadcrumb: CategoryDetailDto["breadcrumb"] = [];
  const visited = new Set<string>();
  for (let node: (typeof all)[number] | undefined = current; node && !visited.has(node.id); ) {
    visited.add(node.id);
    breadcrumb.unshift({ slug: node.slug, name: node.name });
    node = node.parentId ? byId.get(node.parentId) : undefined;
  }

  const min = price._min.sellingPrice;
  const max = price._max.sellingPrice;

  return {
    slug: current.slug,
    name: current.name,
    icon: current.icon ?? "Cpu",
    breadcrumb,
    children: (childrenOf.get(current.id) ?? []).map((child) => ({
      slug: child.slug,
      name: child.name,
      icon: child.icon ?? "Cpu",
      productCount: countOf(child.id),
    })),
    productCount: countOf(current.id),
    brands,
    priceRange: min !== null && max !== null ? { min: Number(min), max: Number(max) } : null,
  };
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
    include: { _count: { select: { products: { where: PUBLIC_FILTER } } } },
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
