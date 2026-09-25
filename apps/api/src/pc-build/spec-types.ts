/** Cỡ bo mạch chủ, xếp từ lớn tới nhỏ — vỏ case nhận cỡ lớn nhất nó liệt kê và mọi cỡ nhỏ hơn */
export const BOARD_SIZES = ["E-ATX", "ATX", "mATX", "ITX"] as const;
export type BoardSize = (typeof BOARD_SIZES)[number];

/** Trường riêng của từng loại, lưu ở cột `ProductSpec.extra` (schema ghi rõ cột này dành cho việc đó) */
export interface SpecExtra {
  /** CPU: mức tiêu thụ tối đa hãng công bố ("125 W (tối đa 250 W)") — dùng để ước tính nguồn */
  maxPowerW?: number;
  /** CPU: hộp có kèm tản nhiệt không — CHỈ có khi dữ liệu ghi rõ, không đoán theo chữ "Box" */
  coolerIncluded?: boolean;
  /** VGA: công suất nguồn hãng khuyến nghị cho cả hệ thống */
  recommendedPsuW?: number;
  /** Ghi chú khi phải lấy số liệu từ tên sản phẩm hoặc dữ liệu tự mâu thuẫn */
  notes?: string[];
}

/**
 * Thông số đã chuẩn hoá — đúng các cột của `ProductSpec`, dạng số/chuỗi/boolean thường (không phải
 * Decimal/Json của Prisma). `null` = dữ liệu gốc không có hoặc không đọc được, KHÔNG phải "không có
 * tính năng đó" — bộ kiểm tra tương thích coi null là "chưa đủ dữ liệu", không bao giờ là "tương thích".
 */
export interface NormalizedSpec {
  socket: string | null;
  chipset: string | null;
  cpuCores: number | null;
  cpuThreads: number | null;
  baseClock: number | null;
  boostClock: number | null;
  hasIgpu: boolean | null;
  ramType: string | null;
  ramSpeed: number | null;
  ramCapacity: number | null;
  ramModules: number | null;
  ramSlots: number | null;
  maxRamGb: number | null;
  vramGb: number | null;
  gpuLengthMm: number | null;
  gpuSlotWidth: number | null;
  gpuPowerPins: string | null;
  storageCapacityGb: number | null;
  storageInterface: string | null;
  storageFormFactor: string | null;
  psuWattage: number | null;
  psuEfficiency: string | null;
  psuModular: string | null;
  psuFormFactor: string | null;
  caseFormFactors: BoardSize[] | null;
  caseMaxGpuMm: number | null;
  caseMaxCoolerMm: number | null;
  caseMaxPsuMm: number | null;
  coolerHeightMm: number | null;
  coolerTdpWatts: number | null;
  tdpWatts: number | null;
  formFactor: BoardSize | null;
  extra: SpecExtra;
}

export function emptySpec(): NormalizedSpec {
  return {
    socket: null,
    chipset: null,
    cpuCores: null,
    cpuThreads: null,
    baseClock: null,
    boostClock: null,
    hasIgpu: null,
    ramType: null,
    ramSpeed: null,
    ramCapacity: null,
    ramModules: null,
    ramSlots: null,
    maxRamGb: null,
    vramGb: null,
    gpuLengthMm: null,
    gpuSlotWidth: null,
    gpuPowerPins: null,
    storageCapacityGb: null,
    storageInterface: null,
    storageFormFactor: null,
    psuWattage: null,
    psuEfficiency: null,
    psuModular: null,
    psuFormFactor: null,
    caseFormFactors: null,
    caseMaxGpuMm: null,
    caseMaxCoolerMm: null,
    caseMaxPsuMm: null,
    coolerHeightMm: null,
    coolerTdpWatts: null,
    tdpWatts: null,
    formFactor: null,
    extra: {},
  };
}
