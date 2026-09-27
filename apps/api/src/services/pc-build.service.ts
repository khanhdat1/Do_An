import { prisma } from "@pczone/db";
import {
  buildProductInclude,
  savedBuildInclude,
  savedBuildSummarySelect,
  toBuildCandidateDto,
  toBuildCheckResultDto,
  toBuildProductDto,
  toSavedBuildDto,
  toSavedBuildSummaryDto,
  type BuildProductRow,
} from "../mappers/pc-build.mapper.js";
import { BadRequestError, NotFoundError } from "../middleware/errors.js";
import { checkBuild, evaluateCandidate, type BuildPart, type BuildParts } from "../pc-build/compatibility.js";
import { generateShareCode, isShareCode } from "../pc-build/share-code.js";
import { BUILD_SLOTS, isBuildSlot, SLOT_LABEL_VI, type BuildSlot } from "../pc-build/slots.js";
import { readStoredSpec } from "../pc-build/spec-store.js";
import { emptySpec } from "../pc-build/spec-types.js";
import type { BuildCheckResultDto, BuildComponentListDto, SavedBuildDto, SavedBuildSummaryDto } from "../types/dto.js";
import { isUniqueViolation } from "../utils/prisma-errors.js";
import { PUBLIC_FILTER } from "./product.service.js";

export interface BuildSelectionInput {
  productId: string;
  quantity?: number;
}

export interface ResolvedBuildItem {
  slot: BuildSlot;
  row: BuildProductRow;
  part: BuildPart;
}

const COMPONENT_LIST_LIMIT = 100;
const MY_BUILDS_LIMIT = 50;
const SAVE_ATTEMPTS = 3;

/** Giá luôn đọc mới từ DB; sản phẩm chưa có dòng ProductSpec thì coi như thiếu mọi thông số */
function toPart(row: BuildProductRow, quantity: number): BuildPart {
  return { productId: row.id, quantity, price: Number(row.sellingPrice), spec: row.spec ? readStoredSpec(row.spec) : emptySpec() };
}

export function toParts(items: ResolvedBuildItem[]): BuildParts {
  return Object.fromEntries(items.map((item) => [item.slot, item.part]));
}


/** Loại linh kiện lấy từ danh mục của sản phẩm, không tin phía client gửi */
async function resolveSelection(selection: BuildSelectionInput[]): Promise<{ items: ResolvedBuildItem[]; unavailableProductIds: string[] }> {
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

  const items: ResolvedBuildItem[] = [];
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

/** Mọi linh kiện đang bán VÀ còn hàng, theo thứ tự ô rồi giá tăng dần — danh sách ứng viên cho AI gợi ý cấu hình */
export async function loadSellableComponents(): Promise<ResolvedBuildItem[]> {
  const rows = await prisma.product.findMany({
    where: { ...PUBLIC_FILTER, category: { componentType: { in: [...BUILD_SLOTS] } } },
    include: buildProductInclude,
    orderBy: [{ sellingPrice: "asc" }, { id: "asc" }],
  });
  return rows
    .flatMap((row) => {
      const slot = row.category.componentType;
      const inStock = row.inventoryQuantity - row.reservedQuantity > 0;
      return slot && isBuildSlot(slot) && inStock ? [{ slot, row, part: toPart(row, 1) }] : [];
    })
    .sort((a, b) => BUILD_SLOTS.indexOf(a.slot) - BUILD_SLOTS.indexOf(b.slot));
}

export interface SaveBuildInput {
  name: string;
  items: BuildSelectionInput[];
  ai?: { prompt: string; purpose: string; budget: number | null };
}

/** Bản chụp bất biến kèm link ngắn: sửa rồi lưu lại là một cấu hình mới, link đã gửi đi không đổi */
export async function saveBuild(userId: string | null, input: SaveBuildInput): Promise<SavedBuildDto> {
  const { items, unavailableProductIds } = await resolveSelection(input.items);
  if (unavailableProductIds.length > 0) throw new BadRequestError("Có linh kiện không còn bán — hãy đổi hoặc bỏ linh kiện đó rồi lưu lại");
  if (items.length === 0) throw new BadRequestError("Cấu hình chưa có linh kiện nào để lưu");

  const result = checkBuild(toParts(items));
  for (let attempt = 1; ; attempt++) {
    try {
      const row = await prisma.pcBuild.create({
        data: {
          userId,
          name: input.name,
          purpose: input.ai?.purpose ?? null,
          budget: input.ai?.budget ?? null,
          totalPrice: result.totalPrice,
          estimatedWattage: result.power.estimatedW ?? 0,
          recommendedPsuW: result.power.recommendedPsuW,
          validationResult: result.checks.map((check) => ({ ...check })),
          isValid: result.isValid,
          isAiGenerated: input.ai !== undefined,
          aiPrompt: input.ai?.prompt ?? null,
          shareCode: generateShareCode(),
          items: {
            create: items.map(({ slot, part }) => ({ productId: part.productId, componentType: slot, quantity: part.quantity, priceAtAdd: part.price })),
          },
        },
        include: savedBuildInclude,
      });
      return toSavedBuildDto(row);
    } catch (error) {
      // Trùng shareCode (rất hiếm) thì sinh mã khác
      if (!isUniqueViolation(error) || attempt >= SAVE_ATTEMPTS) throw error;
    }
  }
}

/** Ai có link cũng xem được — không cần đăng nhập */
export async function getSavedBuild(code: string): Promise<SavedBuildDto> {
  const row = isShareCode(code) ? await prisma.pcBuild.findUnique({ where: { shareCode: code }, include: savedBuildInclude }) : null;
  if (!row) throw new NotFoundError("Không tìm thấy cấu hình đã lưu — link có thể sai hoặc cấu hình đã bị xoá");
  return toSavedBuildDto(row);
}

export async function listMyBuilds(userId: string): Promise<SavedBuildSummaryDto[]> {
  const rows = await prisma.pcBuild.findMany({
    where: { userId, shareCode: { not: null } },
    select: savedBuildSummarySelect,
    orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    take: MY_BUILDS_LIMIT,
  });
  return rows.map(toSavedBuildSummaryDto);
}

/** Không phải chủ thì trả 404 như không tồn tại — không lộ việc mã đó có hay không */
export async function deleteMyBuild(userId: string, code: string): Promise<void> {
  const { count } = await prisma.pcBuild.deleteMany({ where: { shareCode: code, userId } });
  if (count === 0) throw new NotFoundError("Không tìm thấy cấu hình này trong danh sách của bạn");
}
