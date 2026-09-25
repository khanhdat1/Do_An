/**
 * Chuẩn hoá thông số linh kiện: đọc Product.specifications của mọi sản phẩm thuộc 7 danh mục Build PC rồi ghi
 * ProductSpec, in báo cáo độ phủ từng trường. Chạy lại bao nhiêu lần cũng được. Từ thư mục apps/api:
 *   npx tsx src/scripts/backfill-product-specs.mts --dry-run   (chỉ in báo cáo, không ghi DB)
 *   npx tsx src/scripts/backfill-product-specs.mts
 */
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { BUILD_SLOTS, isBuildSlot, SLOT_LABEL_VI, type BuildSlot } from "../pc-build/slots.js";
import { parseProductSpec } from "../pc-build/spec-parser.js";
import type { NormalizedSpec, SpecExtra } from "../pc-build/spec-types.js";

config({ path: fileURLToPath(new URL("../../../../.env", import.meta.url)), quiet: true });

const dryRun = process.argv.includes("--dry-run");

const { prisma } = await import("@pczone/db");
const { upsertSpecQuery } = await import("../pc-build/spec-store.js");

const REPORT_FIELDS: Record<BuildSlot, string[]> = {
  CPU: ["socket", "tdpWatts", "extra.maxPowerW", "hasIgpu", "extra.coolerIncluded", "cpuCores", "baseClock", "ramType"],
  MAINBOARD: ["socket", "ramType", "ramSlots", "formFactor", "chipset", "maxRamGb"],
  RAM: ["ramType", "ramCapacity", "ramModules", "ramSpeed"],
  VGA: ["gpuLengthMm", "tdpWatts", "extra.recommendedPsuW", "vramGb", "gpuPowerPins", "gpuSlotWidth"],
  SSD: ["storageCapacityGb", "storageInterface", "storageFormFactor"],
  PSU: ["psuWattage", "psuEfficiency", "psuModular", "psuFormFactor"],
  CASE: ["caseFormFactors", "caseMaxGpuMm", "caseMaxCoolerMm"],
};

function readField(spec: NormalizedSpec, field: string): unknown {
  return field.startsWith("extra.") ? spec.extra[field.slice("extra.".length) as keyof SpecExtra] : spec[field as keyof NormalizedSpec];
}

const products = await prisma.product.findMany({
  where: { category: { componentType: { in: [...BUILD_SLOTS] } } },
  select: { id: true, name: true, status: true, specifications: true, category: { select: { componentType: true } } },
  orderBy: { name: "asc" },
});

const parsed = products.flatMap((product) => {
  const componentType = product.category.componentType;
  if (!componentType || !isBuildSlot(componentType)) return [];
  const spec = parseProductSpec({ componentType, name: product.name, specifications: product.specifications });
  const label = product.status === "ACTIVE" ? product.name : `${product.name} [${product.status}]`;
  return [{ id: product.id, label, componentType, spec }];
});

console.log(`\n${dryRun ? "[DRY RUN] " : ""}Chuẩn hoá thông số ${parsed.length} linh kiện — số sản phẩm đọc được / tổng:\n`);
for (const slot of BUILD_SLOTS) {
  const items = parsed.filter((item) => item.componentType === slot);
  console.log(`${SLOT_LABEL_VI[slot]} (${items.length})`);
  for (const field of REPORT_FIELDS[slot]) {
    const missing = items.filter((item) => readField(item.spec, field) == null);
    const line = `  ${field.padEnd(22)} ${String(items.length - missing.length).padStart(2)}/${items.length}`;
    console.log(missing.length > 0 ? `${line}   thiếu: ${missing.map((item) => item.label).join(" | ")}` : line);
  }
}

const notes = parsed.flatMap((item) => (item.spec.extra.notes ?? []).map((note) => `  - ${item.label}: ${note}`));
if (notes.length > 0) console.log(`\nGhi chú khi đọc:\n${notes.join("\n")}`);

if (dryRun) {
  console.log("\nChưa ghi gì vào DB. Bỏ --dry-run để ghi thật.");
} else if (parsed.length === 0) {
  // Không có sản phẩm nào thì KHÔNG xoá gì — tránh xoá sạch bảng chỉ vì danh mục chưa được seed
  console.log("\nKhông tìm thấy linh kiện nào — không ghi, không xoá gì.");
} else {
  const deleteOrphans = prisma.productSpec.deleteMany({ where: { productId: { notIn: parsed.map((item) => item.id) } } });
  const [removed] = await prisma.$transaction([
    deleteOrphans,
    ...parsed.map((item) => upsertSpecQuery(item.id, item.componentType, item.spec)),
  ]);
  const total = await prisma.productSpec.count();
  console.log(`\n✓ Đã ghi ${parsed.length} dòng, xoá ${removed.count} dòng không còn thuộc danh mục linh kiện. Bảng ProductSpec hiện có ${total} dòng.`);
}

await prisma.$disconnect();
