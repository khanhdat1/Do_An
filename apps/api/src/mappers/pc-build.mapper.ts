import type { Prisma } from "@pczone/db";
import type { BuildCheckResult, CandidateEvaluation } from "../pc-build/compatibility.js";
import { BUILD_SLOTS, isBuildSlot, type BuildSlot } from "../pc-build/slots.js";
import type { NormalizedSpec } from "../pc-build/spec-types.js";
import type {
  BuildCandidateDto,
  BuildCheckResultDto,
  BuildItemDto,
  BuildProductDto,
  SavedBuildDto,
  SavedBuildSummaryDto,
  SpecRowDto,
} from "../types/dto.js";
import { productInclude, toProductDto } from "./product.mapper.js";

export const buildProductInclude = { ...productInclude, spec: true } satisfies Prisma.ProductInclude;

export type BuildProductRow = Prisma.ProductGetPayload<{ include: typeof buildProductInclude }>;

const NO_DATA = "Chưa có dữ liệu";

type SpecEntry = [label: string, value: string | null, usedByRules: boolean];

/** Dòng mà luật tương thích cần luôn hiện (thiếu thì ghi rõ "Chưa có dữ liệu"); dòng phụ thiếu thì bỏ */
function toRows(entries: SpecEntry[]): SpecRowDto[] {
  return entries.flatMap(([label, value, usedByRules]) => {
    if (value !== null) return [{ label, value }];
    return usedByRules ? [{ label, value: NO_DATA }] : [];
  });
}

function unit(value: number | null | undefined, suffix: string): string | null {
  return value === null || value === undefined ? null : `${value} ${suffix}`;
}

function storageCapacity(gb: number | null): string | null {
  if (gb === null) return null;
  return gb >= 1000 && gb % 1000 === 0 ? `${gb / 1000} TB` : `${gb} GB`;
}

export function keySpecs(slot: BuildSlot, spec: NormalizedSpec): SpecRowDto[] {
  switch (slot) {
    case "CPU": {
      const power = spec.tdpWatts === null ? null : `${spec.tdpWatts} W${spec.extra.maxPowerW ? ` (tối đa ${spec.extra.maxPowerW} W)` : ""}`;
      return toRows([
        ["Socket", spec.socket, true],
        ["Nhân / luồng", spec.cpuCores !== null && spec.cpuThreads !== null ? `${spec.cpuCores} nhân / ${spec.cpuThreads} luồng` : null, false],
        ["Điện năng", power, true],
        ["Đồ họa tích hợp", spec.hasIgpu === null ? null : spec.hasIgpu ? "Có" : "Không", true],
        ["Tản nhiệt kèm theo", spec.extra.coolerIncluded === undefined ? null : spec.extra.coolerIncluded ? "Có" : "Không", false],
      ]);
    }
    case "MAINBOARD":
      return toRows([
        ["Socket", spec.socket, true],
        ["Chipset", spec.chipset, false],
        ["Kích thước", spec.formFactor, true],
        ["Loại RAM", spec.ramType, true],
        ["Số khe RAM", unit(spec.ramSlots, "khe"), true],
      ]);
    case "RAM":
      return toRows([
        ["Loại RAM", spec.ramType, true],
        ["Dung lượng", unit(spec.ramCapacity, "GB"), false],
        ["Số thanh", unit(spec.ramModules, "thanh"), true],
        ["Tốc độ", unit(spec.ramSpeed, "MHz"), false],
      ]);
    case "VGA":
      return toRows([
        ["Bộ nhớ", unit(spec.vramGb, "GB"), false],
        ["Chiều dài", unit(spec.gpuLengthMm, "mm"), true],
        ["Điện năng (TDP)", unit(spec.tdpWatts, "W"), true],
        ["Nguồn hãng khuyến nghị", unit(spec.extra.recommendedPsuW, "W"), false],
      ]);
    case "SSD":
      return toRows([
        ["Dung lượng", storageCapacity(spec.storageCapacityGb), false],
        ["Chuẩn kết nối", spec.storageInterface, false],
        ["Kích thước", spec.storageFormFactor, false],
      ]);
    case "PSU":
      return toRows([
        ["Công suất", unit(spec.psuWattage, "W"), true],
        ["Chứng nhận", spec.psuEfficiency, false],
        ["Kiểu dây", spec.psuModular === null ? null : `${spec.psuModular} Modular`, false],
      ]);
    case "CASE":
      return toRows([
        ["Mainboard hỗ trợ", spec.caseFormFactors?.join(", ") ?? null, true],
        ["VGA dài tối đa", unit(spec.caseMaxGpuMm, "mm"), true],
        ["Tản CPU cao tối đa", unit(spec.caseMaxCoolerMm, "mm"), false],
      ]);
  }
}

export function toBuildProductDto(row: BuildProductRow, slot: BuildSlot, spec: NormalizedSpec): BuildProductDto {
  return { ...toProductDto(row), slot, keySpecs: keySpecs(slot, spec), specNotes: spec.extra.notes ?? [] };
}

export function toBuildCandidateDto(product: BuildProductDto, evaluation: CandidateEvaluation): BuildCandidateDto {
  return { product, fit: evaluation.fit, reasons: evaluation.reasons };
}

export const savedBuildInclude = {
  items: { select: { productId: true, componentType: true, quantity: true } },
} satisfies Prisma.PcBuildInclude;

export type SavedBuildRow = Prisma.PcBuildGetPayload<{ include: typeof savedBuildInclude }>;

export function toSavedBuildDto(row: SavedBuildRow): SavedBuildDto {
  const items = row.items.flatMap((item) => (isBuildSlot(item.componentType) ? [{ productId: item.productId, slot: item.componentType, quantity: item.quantity }] : []));
  items.sort((a, b) => BUILD_SLOTS.indexOf(a.slot) - BUILD_SLOTS.indexOf(b.slot));
  return {
    code: row.shareCode ?? "",
    name: row.name,
    purpose: row.purpose,
    budget: row.budget === null ? null : Number(row.budget),
    isAiGenerated: row.isAiGenerated,
    aiPrompt: row.aiPrompt,
    createdAt: row.createdAt.toISOString(),
    totalAtSave: Number(row.totalPrice),
    isValidAtSave: row.isValid,
    items,
  };
}

export const savedBuildSummarySelect = {
  shareCode: true,
  name: true,
  purpose: true,
  isAiGenerated: true,
  createdAt: true,
  totalPrice: true,
  isValid: true,
  _count: { select: { items: true } },
} satisfies Prisma.PcBuildSelect;

export function toSavedBuildSummaryDto(row: Prisma.PcBuildGetPayload<{ select: typeof savedBuildSummarySelect }>): SavedBuildSummaryDto {
  return {
    code: row.shareCode ?? "",
    name: row.name,
    purpose: row.purpose,
    isAiGenerated: row.isAiGenerated,
    createdAt: row.createdAt.toISOString(),
    totalAtSave: Number(row.totalPrice),
    isValidAtSave: row.isValid,
    itemCount: row._count.items,
  };
}

export function toBuildCheckResultDto(items: BuildItemDto[], unavailableProductIds: string[], result: BuildCheckResult): BuildCheckResultDto {
  return {
    items,
    unavailableProductIds,
    checks: result.checks.map((check) => ({ ...check, insufficientData: check.insufficientData === true })),
    power: result.power,
    totalPrice: result.totalPrice,
    missingSlots: result.missingSlots,
    isComplete: result.isComplete,
    isValid: result.isValid,
    status: result.status,
  };
}
