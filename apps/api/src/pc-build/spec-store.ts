// ProductSpec luôn là dữ liệu SUY RA từ Product.specifications: muốn sửa thì sửa thông số sản phẩm rồi đồng bộ lại.
import { Prisma, prisma } from "@pczone/db";
import { isBuildSlot, type BuildSlot } from "./slots.js";
import { parseProductSpec } from "./spec-parser.js";
import type { NormalizedSpec } from "./spec-types.js";

function clamp(value: string | null, maxLength: number): string | null {
  return value === null ? null : value.slice(0, maxLength);
}

/** Ghi MỌI cột, kể cả null, để lần chạy sau xoá được giá trị cũ không còn đọc ra; độ dài chuỗi theo đúng VarChar */
function toColumns(spec: NormalizedSpec) {
  return {
    socket: clamp(spec.socket, 50),
    chipset: clamp(spec.chipset, 50),
    cpuCores: spec.cpuCores,
    cpuThreads: spec.cpuThreads,
    baseClock: spec.baseClock,
    boostClock: spec.boostClock,
    hasIgpu: spec.hasIgpu,
    ramType: clamp(spec.ramType, 20),
    ramSpeed: spec.ramSpeed,
    ramCapacity: spec.ramCapacity,
    ramModules: spec.ramModules,
    ramSlots: spec.ramSlots,
    maxRamGb: spec.maxRamGb,
    vramGb: spec.vramGb,
    gpuLengthMm: spec.gpuLengthMm,
    gpuSlotWidth: spec.gpuSlotWidth,
    gpuPowerPins: clamp(spec.gpuPowerPins, 50),
    storageCapacityGb: spec.storageCapacityGb,
    storageInterface: clamp(spec.storageInterface, 30),
    storageFormFactor: clamp(spec.storageFormFactor, 30),
    psuWattage: spec.psuWattage,
    psuEfficiency: clamp(spec.psuEfficiency, 30),
    psuModular: clamp(spec.psuModular, 20),
    psuFormFactor: clamp(spec.psuFormFactor, 20),
    caseFormFactors: spec.caseFormFactors ?? Prisma.DbNull,
    caseMaxGpuMm: spec.caseMaxGpuMm,
    caseMaxCoolerMm: spec.caseMaxCoolerMm,
    caseMaxPsuMm: spec.caseMaxPsuMm,
    coolerHeightMm: spec.coolerHeightMm,
    coolerTdpWatts: spec.coolerTdpWatts,
    tdpWatts: spec.tdpWatts,
    formFactor: clamp(spec.formFactor, 30),
    extra: Object.keys(spec.extra).length > 0 ? { ...spec.extra } : Prisma.DbNull,
  };
}

/** Chưa chạy cho tới khi await hoặc đưa vào prisma.$transaction([...]) */
export function upsertSpecQuery(productId: string, componentType: BuildSlot, spec: NormalizedSpec) {
  const columns = toColumns(spec);
  return prisma.productSpec.upsert({
    where: { productId },
    create: { productId, componentType, ...columns },
    update: { componentType, ...columns },
  });
}

/** Đọc lại một sản phẩm và ghi lại spec; sản phẩm không (còn) thuộc danh mục linh kiện Build PC thì xoá spec cũ */
export async function syncProductSpec(productId: string): Promise<void> {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { name: true, specifications: true, category: { select: { componentType: true } } },
  });
  const componentType = product?.category.componentType;

  if (!product || !componentType || !isBuildSlot(componentType)) {
    await prisma.productSpec.deleteMany({ where: { productId } });
    return;
  }

  await upsertSpecQuery(productId, componentType, parseProductSpec({ componentType, name: product.name, specifications: product.specifications }));
}
