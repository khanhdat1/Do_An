/**
 * Cài đặt hệ thống — nguồn DUY NHẤT cho hotline/email/địa chỉ, phí vận chuyển, bật/tắt phương thức thanh toán và
 * tính năng AI. Phần thuần (mặc định, kiểm tra, ghép, so sánh) nằm ở `settings/system-settings.ts`; file này chỉ
 * đọc/ghi bảng `Setting` và giữ một bộ nhớ đệm ngắn trong tiến trình (API chạy MỘT tiến trình nên xoá đệm ngay lúc
 * ghi là đủ, không cần Redis hay pub/sub).
 */
import { prisma, type Prisma, type UserRole } from "@pczone/db";
import { isConfigured as isAiConfigured } from "../ai/openai-client.js";
import { env } from "../env.js";
import { BadRequestError, ServiceUnavailableError } from "../middleware/errors.js";
import {
  availableAiFeatures,
  availablePaymentMethods,
  diffSettings,
  disabledAiFeatureMessage,
  disabledPaymentMessage,
  mergeWithDefaults,
  paymentSettingsProblem,
  SETTING_GROUPS,
  type AiFeature,
} from "../settings/system-settings.js";
import type {
  AdminSettingsDto,
  PaymentMethodDto,
  PaymentMethodsDto,
  PaymentToggleSettingsDto,
  PublicSettingsDto,
  SystemSettingsDto,
} from "../types/dto.js";
import { logAdminAction } from "./audit-log.service.js";
import { isBankTransferConfigured, isMomoConfigured } from "./manual-payment.service.js";
import { isVnpayConfigured } from "./vnpay.service.js";

export interface AdminActor {
  userId: string;
  role: UserRole;
}

/**
 * Đệm 30 giây: mỗi lượt tạo đơn / tìm AI / mở trang đều cần cài đặt, không đáng một truy vấn DB mỗi lần. Lưu ở
 * trang quản trị thì xoá đệm ngay (`invalidateSettingsCache`) nên thay đổi có hiệu lực tức thì trong API; hạn 30
 * giây chỉ để tự cập nhật nếu ai đó sửa thẳng trong DB (Prisma Studio).
 */
const CACHE_TTL_MS = 30_000;

let cached: { settings: SystemSettingsDto; expiresAt: number } | null = null;
/** Tăng mỗi lần ghi — một lượt đọc DB bắt đầu TRƯỚC lúc ghi mà xong SAU lúc ghi thì không được ghi đè đệm bằng số cũ */
let cacheVersion = 0;
let warnedReadFailure = false;

function invalidateSettingsCache(): void {
  cached = null;
  cacheVersion++;
}

async function readStoredSettings() {
  return prisma.setting.findMany({
    where: { key: { in: [...SETTING_GROUPS] } },
    include: { updatedBy: { select: { fullName: true } } },
  });
}

function toSettings(rows: { key: string; value: Prisma.JsonValue }[]): SystemSettingsDto {
  return mergeWithDefaults(Object.fromEntries(rows.map((row) => [row.key, row.value])));
}

/**
 * Cài đặt hiện hành (đã ghép mặc định). Đọc DB lỗi (vd chưa chạy migration tạo bảng `Setting`) thì dùng mặc định
 * = đúng hành vi trước khi có trang cài đặt, chỉ cảnh báo một lần ở log — không để lỗi này làm hỏng việc đặt hàng.
 */
export async function getSettings(): Promise<SystemSettingsDto> {
  if (cached && cached.expiresAt > Date.now()) return cached.settings;

  const version = cacheVersion;
  try {
    const settings = toSettings(await readStoredSettings());
    if (version === cacheVersion) cached = { settings, expiresAt: Date.now() + CACHE_TTL_MS };
    warnedReadFailure = false;
    return settings;
  } catch (error) {
    if (!warnedReadFailure) {
      console.warn("[settings] Không đọc được bảng Setting, tạm dùng giá trị mặc định:", error instanceof Error ? error.message : error);
      warnedReadFailure = true;
    }
    return mergeWithDefaults({});
  }
}

/** Phương thức nào đã có đủ khoá/số tài khoản trong .env — COD không cần cấu hình gì */
export function configuredPaymentMethods(): PaymentMethodsDto {
  return {
    cod: true,
    vnpay: isVnpayConfigured(env.vnpay),
    bankTransfer: isBankTransferConfigured(env.bankTransfer),
    momo: isMomoConfigured(env.momo),
  };
}

/** `GET /api/payments/methods` — khách chọn được = đã cấu hình VÀ chủ website đang bật */
export async function getAvailablePaymentMethods(): Promise<PaymentMethodsDto> {
  const settings = await getSettings();
  return availablePaymentMethods(settings.payments, configuredPaymentMethods());
}

/** Tạo đơn gọi hàm này: phương thức bị tắt thì 400 kèm câu báo rõ, không chỉ dựa vào việc giao diện đã ẩn nút */
export function assertPaymentMethodEnabled(enabled: PaymentToggleSettingsDto, method: PaymentMethodDto): void {
  const message = disabledPaymentMessage(enabled, method);
  if (message) throw new BadRequestError(message);
}

/** AI Search dùng: tắt thì trả `false` để lùi về tìm kiếm từ khoá, không báo lỗi */
export async function isAiFeatureEnabled(feature: AiFeature): Promise<boolean> {
  return (await getSettings()).ai[feature];
}

/** AI Chat / AI gợi ý cấu hình dùng: tắt thì 503 kèm câu báo rõ để giao diện hiện thông báo thay vì im lặng */
export async function assertAiFeatureEnabled(feature: AiFeature, hint?: string): Promise<void> {
  if (await isAiFeatureEnabled(feature)) return;
  throw new ServiceUnavailableError(hint ? `${disabledAiFeatureMessage(feature)} ${hint}` : disabledAiFeatureMessage(feature));
}

/** `GET /api/settings` — chỉ giá trị công khai; `payments`/`ai` là trạng thái dùng được thật, không phải công tắc thô */
export async function getPublicSettings(): Promise<PublicSettingsDto> {
  const settings = await getSettings();
  return {
    store: settings.store,
    shipping: settings.shipping,
    payments: availablePaymentMethods(settings.payments, configuredPaymentMethods()),
    ai: availableAiFeatures(settings.ai, isAiConfigured()),
  };
}

/** `GET /api/admin/settings` — đọc thẳng DB (không qua đệm) để trang quản trị luôn thấy đúng số đang lưu */
export async function getAdminSettings(): Promise<AdminSettingsDto> {
  const rows = await readStoredSettings();
  const latest = rows.reduce<(typeof rows)[number] | null>((found, row) => (!found || row.updatedAt > found.updatedAt ? row : found), null);

  return {
    settings: toSettings(rows),
    configured: { payments: configuredPaymentMethods(), ai: isAiConfigured() },
    updatedAt: latest?.updatedAt.toISOString(),
    updatedByName: latest?.updatedBy?.fullName,
  };
}

/**
 * `PUT /api/admin/settings` — nhận đủ 4 nhóm (đã qua zod ở route), chỉ ghi những nhóm thật sự đổi, ghi nhật ký
 * trước/sau của đúng các trường đã đổi trong CÙNG transaction, rồi xoá đệm để lượt đặt hàng/tìm kiếm kế tiếp dùng
 * ngay số mới. Không đổi gì thì không ghi gì (không có dòng nhật ký rỗng).
 */
export async function updateSettings(input: SystemSettingsDto, admin: AdminActor): Promise<AdminSettingsDto> {
  const problem = paymentSettingsProblem(input.payments, configuredPaymentMethods());
  if (problem) throw new BadRequestError(problem);

  const current = toSettings(await readStoredSettings());
  const diff = diffSettings(current, input);
  if (diff.changedGroups.length === 0) return getAdminSettings();

  await prisma.$transaction(async (tx) => {
    for (const group of diff.changedGroups) {
      // DTO là interface (không có chữ ký chỉ mục) nên phải ép kiểu sang JSON của Prisma — dữ liệu đã qua zod ở route
      const value = { ...input[group] } as unknown as Prisma.InputJsonObject;
      await tx.setting.upsert({
        where: { key: group },
        create: { key: group, value, updatedById: admin.userId },
        update: { value, updatedById: admin.userId },
      });
    }
    await logAdminAction(tx, {
      actorId: admin.userId,
      actorRole: admin.role,
      action: "settings.updated",
      targetType: "Setting",
      targetId: diff.changedGroups.join(","),
      metadata: { changed: diff.changedKeys, before: diff.before, after: diff.after } as unknown as Prisma.InputJsonValue,
    });
  });

  invalidateSettingsCache();
  return getAdminSettings();
}
