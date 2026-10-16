/**
 * Ghi Product.aiSearchText cho các sản phẩm còn để trống (chủ yếu source = "MANUAL" do admin tạo trước khi form
 * thêm/sửa sản phẩm tự ghi cột này). embedding-store chỉ nhúng sản phẩm có aiSearchText nên những sản phẩm này không
 * xuất hiện trong AI Search/Chat. Sản phẩm đã có aiSearchText giữ nguyên. Chạy lại bao nhiêu lần cũng được. Từ thư
 * mục apps/api:
 *   npx tsx src/scripts/backfill-ai-search-text.mts --dry-run   (chỉ in danh sách, không ghi DB)
 *   npx tsx src/scripts/backfill-ai-search-text.mts
 */
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { buildAiSearchText } from "../ai/search-text.js";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)), quiet: true });

const dryRun = process.argv.includes("--dry-run");

const { prisma } = await import("@pczone/db");
const { readAllShortSpecs, readSpecifications } = await import("../mappers/product.mapper.js");

// Chuỗi rỗng cũng coi là thiếu: embedding-store bỏ qua văn bản rỗng giống như null
const missingText = { OR: [{ aiSearchText: null }, { aiSearchText: "" }] };

const products = await prisma.product.findMany({
  where: missingText,
  select: {
    id: true,
    name: true,
    source: true,
    status: true,
    shortDescription: true,
    shortSpecs: true,
    specifications: true,
    brand: { select: { name: true } },
    category: { select: { name: true } },
  },
  orderBy: { name: "asc" },
});

const rows = products.map((product) => ({
  id: product.id,
  label: `${product.name} [${product.source}, ${product.status}]`,
  aiSearchText: buildAiSearchText({
    name: product.name,
    brandName: product.brand?.name,
    categoryName: product.category.name,
    shortDescription: product.shortDescription,
    shortSpecs: readAllShortSpecs(product.shortSpecs),
    specifications: readSpecifications(product.specifications),
  }),
}));

const bySource = new Map<string, number>();
for (const product of products) bySource.set(product.source, (bySource.get(product.source) ?? 0) + 1);

console.log(`\n${dryRun ? "[DRY RUN] " : ""}${rows.length} sản phẩm chưa có aiSearchText:`);
for (const [source, count] of bySource) console.log(`  ${source.padEnd(12)} ${count}`);
for (const row of rows) console.log(`  - ${row.label} (${row.aiSearchText.length} ký tự)`);

if (dryRun) {
  console.log(`\nSẽ ghi ${rows.length} dòng. Chưa ghi gì vào DB. Bỏ --dry-run để ghi thật.`);
} else if (rows.length === 0) {
  console.log("\nKhông có gì để ghi.");
} else {
  // Lọc lại điều kiện trống ngay lúc ghi: admin vừa sửa sản phẩm (đã có aiSearchText mới) thì không ghi đè
  const results = await prisma.$transaction(
    rows.map((row) => prisma.product.updateMany({ where: { id: row.id, ...missingText }, data: { aiSearchText: row.aiSearchText } })),
  );
  const written = results.reduce((sum, result) => sum + result.count, 0);
  const remaining = await prisma.product.count({ where: missingText });
  console.log(`\n✓ Đã ghi ${written}/${rows.length} dòng. Còn ${remaining} sản phẩm chưa có aiSearchText.`);
  console.log("API đang chạy sẽ nhúng các sản phẩm ACTIVE vừa ghi khi chỉ mục embedding hết TTL 15 phút hoặc khởi động lại.");
}

await prisma.$disconnect();
