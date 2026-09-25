import { prisma } from "@pczone/db";
import {
  buildProductInclude,
  toBuildCandidateDto,
  toBuildCheckResultDto,
  toBuildProductDto,
  type BuildProductRow,
} from "../mappers/pc-build.mapper.js";
import { BadRequestError } from "../middleware/errors.js";
import { checkBuild, evaluateCandidate, type BuildPart, type BuildParts } from "../pc-build/compatibility.js";
import { BUILD_SLOTS, isBuildSlot, SLOT_LABEL_VI, type BuildSlot } from "../pc-build/slots.js";
import { readStoredSpec } from "../pc-build/spec-store.js";
import { emptySpec } from "../pc-build/spec-types.js";
import type { BuildCheckResultDto, BuildComponentListDto } from "../types/dto.js";
import { PUBLIC_FILTER } from "./product.service.js";

export interface BuildSelectionInput {
  productId: string;
  quantity?: number;
}

interface ResolvedItem {
  slot: BuildSlot;
  row: BuildProductRow;
  part: BuildPart;
}

const COMPONENT_LIST_LIMIT = 100;

/** Giá luôn đọc mới từ DB; sản phẩm chưa có dòng ProductSpec thì coi như thiếu mọi thông số */
function toPart(row: BuildProductRow, quantity: number): BuildPart {
  return { productId: row.id, quantity, price: Number(row.sellingPrice), spec: row.spec ? readStoredSpec(row.spec) : emptySpec() };
}

function toParts(items: ResolvedItem[]): BuildParts {
  return Object.fromEntries(items.map((item) => [item.slot, item.part]));
}

/** Loại linh kiện lấy từ danh mục của sản phẩm, không tin phía client gửi */
async function resolveSelection(selection: BuildSelectionInput[]): Promise<{ items: ResolvedItem[]; unavailableProductIds: string[] }> {
  const ids = selection.map((item) => item.productId);
  if (new Set(ids).size !== ids.length) throw new BadRequestError("Mỗi sản phẩm chỉ được chọn một lần");

  const rows =
    ids.length === 0
      ? []
      : await prisma.product.findMany({
          where: { ...PUBLIC_FILTER, id: { in: ids }, category: { componentType: { in: [...BUILD_SLOTS] } } },
          include: buildProductInclude,
        });
  const rowById = new Map(rows.map((row) => [row.id, row]));

  const items: ResolvedItem[] = [];
  const unavailableProductIds: string[] = [];
  for (const { productId, quantity = 1 } of selection) {
    const row = rowById.get(productId);
    const slot = row?.category.componentType;
    if (!row || !slot || !isBuildSlot(slot)) {
      unavailableProductIds.push(productId);
      continue;
    }
    if (items.some((item) => item.slot === slot)) throw new BadRequestError(`Mỗi cấu hình chỉ chọn một sản phẩm ${SLOT_LABEL_VI[slot]}`);
    if (slot !== "RAM" && quantity !== 1) throw new BadRequestError(`${SLOT_LABEL_VI[slot]} chỉ chọn được số lượng 1`);
    items.push({ slot, row, part: toPart(row, quantity) });
  }

  items.sort((a, b) => BUILD_SLOTS.indexOf(a.slot) - BUILD_SLOTS.indexOf(b.slot));
  return { items, unavailableProductIds };
}

/** `POST /api/pc-build/validate` */
export async function validateBuild(selection: BuildSelectionInput[]): Promise<BuildCheckResultDto> {
  const { items, unavailableProductIds } = await resolveSelection(selection);
  const result = checkBuild(toParts(items));
  const itemDtos = items.map(({ slot, row, part }) => ({ slot, quantity: part.quantity, product: toBuildProductDto(row, slot, part.spec) }));
  return toBuildCheckResultDto(itemDtos, unavailableProductIds, result);
}

/** `GET /api/pc-build/components` — gắn huy hiệu tương thích theo cấu hình đang chọn, không lọc bỏ lựa chọn nào */
export async function listBuildComponents(slot: BuildSlot, selection: BuildSelectionInput[]): Promise<BuildComponentListDto> {
  const [{ items: selected }, rows] = await Promise.all([
    resolveSelection(selection),
    prisma.product.findMany({
      where: { ...PUBLIC_FILTER, category: { componentType: slot } },
      include: buildProductInclude,
      orderBy: [{ sellingPrice: "asc" }, { id: "asc" }],
      take: COMPONENT_LIST_LIMIT,
    }),
  ]);

  const parts = toParts(selected);
  const quantity = slot === "RAM" ? (parts.RAM?.quantity ?? 1) : 1;

  const candidates = rows.map((row) => {
    const part = toPart(row, quantity);
    return toBuildCandidateDto(toBuildProductDto(row, slot, part.spec), evaluateCandidate(parts, slot, part));
  });
  // Sắp xếp ổn định: còn hàng lên trước, trong mỗi nhóm giữ thứ tự giá tăng dần
  candidates.sort((a, b) => Number(b.product.inStock) - Number(a.product.inStock));

  return { slot, items: candidates };
}
