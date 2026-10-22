// Kiểm thử bộ lọc thông số của trang danh mục: hồ sơ danh mục, đọc tham số URL, dựng điều kiện SQL và đếm số sản phẩm
// mỗi lựa chọn — không cần DB. Chạy: npx tsx src/catalog/spec-filters.test.ts
import type { ComponentType, Prisma } from "@pczone/db";
import {
  COMPONENT_FACETS,
  componentFacetValues,
  componentSpecWhere,
  computeFacetGroups,
  computerFacetValues,
  facetProfileOf,
  idsMatching,
  matchesSelections,
  parseSpecSelections,
  pcieGenOf,
  storageTierOf,
  wattageBucketOf,
  type FacetRow,
  type SpecFacetRow,
} from "./spec-filters.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}\n      mong đợi: ${e}\n      nhận được: ${a}`);
    failed++;
  }
}

/** Dòng ProductSpec như trong DB: mặc định mọi cột null */
function spec(componentType: ComponentType, columns: Partial<SpecFacetRow>): SpecFacetRow {
  return {
    componentType,
    socket: null,
    chipset: null,
    formFactor: null,
    ramType: null,
    ramCapacity: null,
    vramGb: null,
    storageCapacityGb: null,
    storageInterface: null,
    psuWattage: null,
    ...columns,
  };
}

/**
 * Chạy điều kiện Prisma trên một dòng, đúng ngữ nghĩa MySQL với collation utf8mb4_0900_ai_ci (so chuỗi không phân biệt
 * hoa thường) — chỉ phần cú pháp mà spec-filters.ts dùng. Để kiểm rằng danh sách lọc bằng SQL ra ĐÚNG những sản phẩm
 * mà con số đếm (tính bằng JS) đã hứa.
 */
function evaluate(where: Prisma.ProductSpecWhereInput, row: SpecFacetRow & { id?: string }): boolean {
  for (const [key, condition] of Object.entries(where)) {
    if (key === "AND") {
      if (!(condition as Prisma.ProductSpecWhereInput[]).every((item) => evaluate(item, row))) return false;
      continue;
    }
    if (key === "OR") {
      if (!(condition as Prisma.ProductSpecWhereInput[]).some((item) => evaluate(item, row))) return false;
      continue;
    }
    const value = (row as Record<string, unknown>)[key];
    if (typeof condition !== "object" || condition === null) {
      if (value !== condition) return false;
      continue;
    }
    const filter = condition as { in?: unknown[]; gte?: number; lte?: number; startsWith?: string };
    if (value === null || value === undefined) return false;
    const same = (a: unknown, b: unknown) => (typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b);
    if (filter.in && !filter.in.some((item) => same(item, value))) return false;
    if (filter.gte !== undefined && !((value as number) >= filter.gte)) return false;
    if (filter.lte !== undefined && !((value as number) <= filter.lte)) return false;
    if (filter.startsWith !== undefined && !String(value).toLowerCase().startsWith(filter.startsWith.toLowerCase())) return false;
  }
  return true;
}

console.log("\n[1] Hồ sơ danh mục theo componentType của cả nhánh");
{
  check("CPU", facetProfileOf(["CPU"]), { kind: "component", type: "CPU" });
  check("cha không gắn loại + con là mainboard", facetProfileOf([null, "MAINBOARD"]), { kind: "component", type: "MAINBOARD" });
  check("laptop (không gắn loại ở cả cha lẫn con)", facetProfileOf([null, null, null]), { kind: "computer" });
  check("Linh kiện: trộn nhiều loại → không lọc", facetProfileOf([null, "CPU", "RAM", "VGA"]), null);
  check("vỏ case chưa có nhóm lọc → không lọc", facetProfileOf(["CASE"]), null);
  check("màn hình → không lọc", facetProfileOf(["MONITOR"]), null);
  check("gear: bàn phím + chuột → không lọc", facetProfileOf([null, "KEYBOARD", "MOUSE"]), null);
}

console.log("\n[2] Đọc tham số URL");
{
  const mainboard = { kind: "component", type: "MAINBOARD" } as const;
  check(
    "chuẩn hoá cách viết, bỏ trùng",
    parseSpecSelections(mainboard, { socket: ["am5", "AM5", "lga1851"], formFactor: ["matx", "ATX"], ramType: ["ddr5"] }),
    { socket: ["AM5", "LGA1851"], formFactor: ["mATX", "ATX"], ramType: ["DDR5"] },
  );
  check("nhóm không thuộc loại hàng bị bỏ qua (VRAM ở trang mainboard)", parseSpecSelections(mainboard, { vram: ["16"], socket: ["AM5"] }), { socket: ["AM5"] });
  check("cỡ mainboard lạ bị bỏ", parseSpecSelections(mainboard, { formFactor: ["XL-ATX"] }), {});
  check("socket lạ nhưng đúng định dạng vẫn giữ (khớp 0 sản phẩm)", parseSpecSelections(mainboard, { socket: ["LGA9999"] }), { socket: ["LGA9999"] });

  const ram = { kind: "component", type: "RAM" } as const;
  check("dung lượng phải là số nguyên dương", parseSpecSelections(ram, { ram: ["16", "abc", "0", "032"] }), { ram: ["16", "32"] });

  const laptop = { kind: "computer" } as const;
  check(
    "laptop: socket bị bỏ, dòng CPU về chữ thường",
    parseSpecSelections(laptop, { socket: ["AM5"], cpuLine: ["Core-I7"], gpu: ["RTX-4060"], storage: ["512", "300"] }),
    { cpuLine: ["core-i7"], gpu: ["rtx-4060"], storage: ["512"] },
  );
}

console.log("\n[3] Dải giá trị");
{
  check("500 GB và 512 GB cùng một mức", [storageTierOf(500), storageTierOf(512)], ["512", "512"]);
  check("960 / 1000 / 1024 GB đều là 1 TB", [960, 1000, 1024].map(storageTierOf), ["1000", "1000", "1000"]);
  check("dung lượng ngoài mọi mức → null", [storageTierOf(300), storageTierOf(null)], [null, null]);
  check("công suất theo khoảng", [550, 600, 650, 749, 750, 850, 999, 1000, 1600].map(wattageBucketOf), [
    "duoi-600",
    "600-749",
    "600-749",
    "600-749",
    "750-999",
    "750-999",
    "750-999",
    "tu-1000",
    "tu-1000",
  ]);
  check("PCIe theo dạng spec-parser ghi", ["NVMe PCIe 4.0 x4", "PCIe 3.0 x4", "NVMe PCIe 5.0 x4", "SATA III", null].map(pcieGenOf), [
    "pcie4",
    "pcie3",
    "pcie5",
    null,
    null,
  ]);
}

console.log("\n[4] Điều kiện SQL trên ProductSpec");
{
  check("không chọn gì → null", componentSpecWhere("MAINBOARD", {}), null);
  check(
    "mainboard AM5 + DDR5: kèm componentType để đi index",
    componentSpecWhere("MAINBOARD", { socket: ["AM5"], ramType: ["DDR5"] }),
    { componentType: "MAINBOARD", AND: [{ socket: { in: ["AM5"] } }, { ramType: { in: ["DDR5"] } }] },
  );
  check("RAM theo dung lượng là số", componentSpecWhere("RAM", { ram: ["16", "32"] }), {
    componentType: "RAM",
    AND: [{ ramCapacity: { in: [16, 32] } }],
  });
  check("SSD theo mức dung lượng → khoảng", componentSpecWhere("SSD", { storage: ["512", "2000"] }), {
    componentType: "SSD",
    AND: [{ OR: [{ storageCapacityGb: { gte: 480, lte: 512 } }, { storageCapacityGb: { gte: 1920, lte: 2048 } }] }],
  });
  check("nguồn từ 1000 W: không có cận trên", componentSpecWhere("PSU", { wattage: ["tu-1000"] }), {
    componentType: "PSU",
    AND: [{ OR: [{ psuWattage: { gte: 1000 } }] }],
  });
  check("nhóm không thuộc loại hàng không lọt vào điều kiện", componentSpecWhere("CPU", { vram: ["16"] }), null);

  // Mọi lựa chọn, mọi dòng: điều kiện SQL đúng bằng giá trị JS đọc ra → con số đếm khớp danh sách
  const samples: SpecFacetRow[] = [
    spec("CPU", { socket: "AM5" }),
    spec("CPU", { socket: "LGA1851" }),
    spec("CPU", {}),
    spec("MAINBOARD", { socket: "AM4", chipset: "B450", formFactor: "mATX", ramType: "DDR4" }),
    spec("MAINBOARD", { socket: "AM5", chipset: "X870", formFactor: "ATX", ramType: "DDR5" }),
    spec("MAINBOARD", { socket: "LGA1700", chipset: "H610", formFactor: "ITX", ramType: null }),
    spec("RAM", { ramType: "DDR5", ramCapacity: 32 }),
    spec("RAM", { ramType: "DDR4", ramCapacity: 8 }),
    spec("VGA", { vramGb: 16 }),
    spec("VGA", { vramGb: 8 }),
    spec("SSD", { storageCapacityGb: 500, storageInterface: "NVMe PCIe 4.0 x4" }),
    spec("SSD", { storageCapacityGb: 512, storageInterface: "NVMe PCIe 3.0 x4" }),
    spec("SSD", { storageCapacityGb: 2000, storageInterface: "PCIe 5.0 x4" }),
    spec("SSD", { storageCapacityGb: 300, storageInterface: "SATA III" }),
    spec("PSU", { psuWattage: 550 }),
    spec("PSU", { psuWattage: 750 }),
    spec("PSU", { psuWattage: 1250 }),
    spec("PSU", { psuWattage: null }),
  ];
  let mismatches = 0;
  let pairs = 0;
  for (const [type, defs] of Object.entries(COMPONENT_FACETS) as [ComponentType, NonNullable<(typeof COMPONENT_FACETS)[ComponentType]>][]) {
    const rows = samples.filter((row) => row.componentType === type);
    for (const def of defs) {
      const values = new Set(rows.map((row) => def.read(row)).filter((value): value is string => value !== null));
      for (const value of values) {
        const where = componentSpecWhere(type, { [def.key]: [value] });
        for (const row of rows) {
          pairs++;
          if (!where || evaluate(where, row) !== (def.read(row) === value)) mismatches++;
        }
      }
    }
  }
  check(`điều kiện SQL khớp giá trị JS ở cả ${pairs} cặp (lựa chọn, sản phẩm)`, mismatches, 0);
  check(
    "giá trị dải lạ trên URL không khớp sản phẩm nào",
    samples.filter((row) => row.componentType === "PSU").some((row) => evaluate(COMPONENT_FACETS.PSU![0].where(["9999"]), row)),
    false,
  );
}

console.log("\n[5] Giá trị lọc của từng sản phẩm");
{
  check(
    "mainboard đọc đủ 4 nhóm",
    componentFacetValues("MAINBOARD", spec("MAINBOARD", { socket: "AM5", chipset: "B650", formFactor: "mATX", ramType: "DDR5" })),
    { socket: "AM5", chipset: "B650", formFactor: "mATX", ramType: "DDR5" },
  );
  check("cột null không thành giá trị", componentFacetValues("SSD", spec("SSD", { storageCapacityGb: 1000 })), { storage: "1000" });
  check("chưa có dòng spec → không có dữ liệu", componentFacetValues("CPU", null), {});
  check("dòng spec của loại khác (chưa đồng bộ lại) → không có dữ liệu", componentFacetValues("CPU", spec("MAINBOARD", { socket: "AM5" })), {});
  check(
    "laptop: bỏ trường null",
    computerFacetValues({ cpuBrand: "amd", cpuLine: "ryzen-7", ramGb: 16, gpu: null, storageGb: 512 }),
    { cpuBrand: "amd", cpuLine: "ryzen-7", ram: "16", storage: "512" },
  );
  check("khớp: HOẶC trong nhóm, VÀ giữa các nhóm", matchesSelections({ socket: "AM5", ramType: "DDR5" }, { socket: ["AM4", "AM5"], ramType: ["DDR5"] }), true);
  check("không có dữ liệu ở nhóm đang lọc → không khớp", matchesSelections({ socket: "AM5" }, { ramType: ["DDR5"] }), false);
  check("bỏ qua nhóm `skip`", matchesSelections({ socket: "AM5" }, { socket: ["AM4"] }, "socket"), true);
}

console.log("\n[6] Đếm và độ tin cậy của từng nhóm");
{
  const laptop = { kind: "computer" } as const;
  // 10 máy: hãng CPU + RAM có đủ, card đồ họa chỉ 7/10 máy ghi (dưới 80%), ổ cứng 9/10 nhưng chỉ một mức
  const rows: FacetRow[] = [
    { id: "a", values: { cpuBrand: "intel", cpuLine: "core-i5", ram: "16", gpu: "rtx-4060", storage: "512" } },
    { id: "b", values: { cpuBrand: "intel", cpuLine: "core-i7", ram: "16", gpu: "rtx-4060", storage: "512" } },
    { id: "c", values: { cpuBrand: "intel", cpuLine: "core-i7", ram: "32", gpu: "rtx-4070", storage: "512" } },
    { id: "d", values: { cpuBrand: "amd", cpuLine: "ryzen-7", ram: "16", gpu: "rtx-4050", storage: "512" } },
    { id: "e", values: { cpuBrand: "amd", cpuLine: "ryzen-5", ram: "8", gpu: "rtx-3050", storage: "512" } },
    { id: "f", values: { cpuBrand: "amd", cpuLine: "ryzen-7", ram: "32", gpu: "rtx-4060", storage: "512" } },
    { id: "g", values: { cpuBrand: "intel", cpuLine: "core-5", ram: "16", gpu: "tich-hop", storage: "512" } },
    { id: "h", values: { cpuBrand: "intel", cpuLine: "core-5", ram: "8", storage: "512" } },
    { id: "i", values: { cpuBrand: "intel", ram: "16", storage: "512" } },
    { id: "j", values: { cpuBrand: "amd", cpuLine: "ryzen-5", ram: "16" } },
  ];
  const summary = (groups: ReturnType<typeof computeFacetGroups>) =>
    Object.fromEntries(groups.map((group) => [group.key, group.options.map((option) => `${option.value}:${option.count}`).join(" ")]));

  const all = computeFacetGroups(laptop, rows, null, {});
  check("chỉ hiện nhóm ≥ 80% có dữ liệu và ≥ 2 giá trị; thứ tự lựa chọn theo bảng dòng CPU / số", summary(all), {
    cpuBrand: "intel:6 amd:4",
    cpuLine: "core-i5:1 core-i7:2 core-5:2 ryzen-5:2 ryzen-7:2",
    ram: "8:2 16:6 32:2",
  });
  check("nhãn hiển thị", all.find((group) => group.key === "cpuLine")?.options.map((option) => option.label).slice(0, 3), [
    "Intel Core i5",
    "Intel Core i7",
    "Intel Core 5",
  ]);

  const amd = computeFacetGroups(laptop, rows, null, { cpuBrand: ["amd"] });
  check("chọn AMD: nhóm hãng giữ nguyên con số (HOẶC trong nhóm), nhóm khác đếm trong máy AMD", summary(amd), {
    cpuBrand: "intel:6 amd:4",
    cpuLine: "core-i5:0 core-i7:0 core-5:0 ryzen-5:2 ryzen-7:2",
    ram: "8:1 16:2 32:1",
  });

  const filtered = computeFacetGroups(laptop, rows, new Set(["a", "b", "c", "d"]), {});
  check("bộ lọc khác (hãng, giá) thu hẹp con số nhưng không làm mất lựa chọn", summary(filtered), {
    cpuBrand: "intel:3 amd:1",
    cpuLine: "core-i5:1 core-i7:2 core-5:0 ryzen-5:0 ryzen-7:1",
    ram: "8:0 16:3 32:1",
  });

  const withGpu = computeFacetGroups(laptop, rows, null, { gpu: ["rtx-4060"] });
  check(
    "nhóm chưa đủ tin cậy vẫn hiện khi URL đang chọn nó (để bỏ chọn được)",
    withGpu.find((group) => group.key === "gpu")?.options.map((option) => `${option.value}:${option.count}`),
    ["rtx-3050:1", "rtx-4050:1", "rtx-4060:3", "rtx-4070:1", "tich-hop:1"],
  );
  check("…và các nhóm khác đếm trong 3 máy RTX 4060", summary(withGpu).ram, "8:0 16:2 32:1");

  const unknown = computeFacetGroups(laptop, rows, null, { cpuLine: ["core-x99"] });
  check(
    "giá trị lạ đang chọn hiện ở cuối với 0 sản phẩm",
    unknown.find((group) => group.key === "cpuLine")?.options.at(-1),
    { value: "core-x99", label: "core-x99", count: 0 },
  );
  check("danh mục rỗng → không nhóm nào", computeFacetGroups(laptop, [], null, {}), []);
  check("id khớp bộ lọc laptop", idsMatching(rows, { cpuBrand: ["amd"], ram: ["16", "32"] }), ["d", "f", "j"]);

  const cpu = { kind: "component", type: "CPU" } as const;
  const sockets: FacetRow[] = ["AM5", "AM5", "LGA1851", "AM4"].map((socket, index) => ({ id: String(index), values: { socket } }));
  check("linh kiện: socket", summary(computeFacetGroups(cpu, sockets, null, {})), { socket: "AM4:1 AM5:2 LGA1851:1" });
  check(
    "linh kiện chỉ một giá trị → không hiện nhóm",
    computeFacetGroups(cpu, sockets.map((row) => ({ ...row, values: { socket: "AM5" } })), null, {}),
    [],
  );
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
