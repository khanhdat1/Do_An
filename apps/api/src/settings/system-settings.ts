/**
 * Cài đặt hệ thống — phần THUẦN (không DB, không env): giá trị mặc định, kiểm tra dữ liệu, ghép với mặc
 * định, so sánh trước/sau cho nhật ký, suy ra phương thức thanh toán dùng được. Tách khỏi
 * `services/settings.service.ts` (đọc/ghi DB + cache) để kiểm thử được bằng `settings.test.ts` mà không
 * cần MySQL — cùng cách `pc-build/`, `search/` đang tách phần tính toán khỏi phần đọc DB.
 */
import { z } from "zod";
import type { AiToggleSettingsDto, PaymentMethodDto, PaymentMethodsDto, PaymentToggleSettingsDto, SystemSettingsDto } from "../types/dto.js";

export const SETTING_GROUPS = ["store", "shipping", "payments", "ai"] as const;
export type SettingGroup = (typeof SETTING_GROUPS)[number];

export type AiFeature = keyof AiToggleSettingsDto;

/**
 * Giá trị mặc định = ĐÚNG những gì đang viết cứng trong code trước khi có trang cài đặt (hotline 1800 8888 của
 * TopBar/ProductDescription/phiếu in, phí 30.000đ, miễn phí từ 500.000đ, mọi phương thức/tính năng đều bật) — DB
 * chưa có dòng nào thì hệ thống chạy y như cũ. `apps/web/lib/data/store-settings.ts` có bản sao để web tự dựng
 * trang khi API tắt; đổi mặc định ở đây thì sửa luôn bên đó.
 */
export const DEFAULT_SETTINGS: SystemSettingsDto = {
  store: {
    hotline: "1800 8888",
    supportEmail: "support@pczone.vn",
    // Trước đây chưa nơi nào hiện địa chỉ showroom — để trống thay vì bịa một địa chỉ, chủ website tự điền
    showroomAddress: "",
  },
  shipping: {
    flatFee: 30_000,
    freeThreshold: 500_000,
  },
  payments: { cod: true, vnpay: true, bankTransfer: true, momo: true },
  ai: { search: true, chat: true, build: true },
};

export const MAX_SHIPPING_FEE = 1_000_000;
export const MAX_FREE_SHIPPING_THRESHOLD = 100_000_000;

/* -------------------------------------------------------------------------- */
/*  Kiểm tra dữ liệu — dùng cho CẢ body PUT lẫn lúc đọc JSON từ DB             */
/* -------------------------------------------------------------------------- */

const hotlineSchema = z
  .string({ error: "Hotline không hợp lệ" })
  .trim()
  .min(1, "Hotline không được để trống")
  .max(30, "Hotline tối đa 30 ký tự")
  .regex(/^[0-9+().\s-]+$/, "Hotline chỉ gồm chữ số, dấu cách và các ký tự + . - ( )")
  .refine((value) => (value.match(/[0-9]/g) ?? []).length >= 3, "Hotline phải có ít nhất 3 chữ số");

const supportEmailSchema = z
  .string({ error: "Email hỗ trợ không hợp lệ" })
  .trim()
  .max(150, "Email hỗ trợ tối đa 150 ký tự")
  .pipe(z.email("Email hỗ trợ không hợp lệ"));

const showroomAddressSchema = z.string({ error: "Địa chỉ showroom không hợp lệ" }).trim().max(300, "Địa chỉ showroom tối đa 300 ký tự");

const flatFeeSchema = z
  .number({ error: "Phí vận chuyển phải là một số" })
  .int("Phí vận chuyển phải là số nguyên (đồng)")
  .min(0, "Phí vận chuyển không được âm")
  .max(MAX_SHIPPING_FEE, "Phí vận chuyển tối đa 1.000.000đ");

const freeThresholdSchema = z
  .number({ error: "Ngưỡng miễn phí vận chuyển phải là một số" })
  .int("Ngưỡng miễn phí vận chuyển phải là số nguyên (đồng)")
  .min(0, "Ngưỡng miễn phí vận chuyển không được âm")
  .max(MAX_FREE_SHIPPING_THRESHOLD, "Ngưỡng miễn phí vận chuyển tối đa 100.000.000đ");

const toggleSchema = z.boolean({ error: "Giá trị bật/tắt không hợp lệ" });

/** Body `PUT /api/admin/settings` — gửi đủ cả 4 nhóm; trường lạ bị bỏ qua */
export const systemSettingsSchema = z.object({
  store: z.object({ hotline: hotlineSchema, supportEmail: supportEmailSchema, showroomAddress: showroomAddressSchema }),
  shipping: z.object({ flatFee: flatFeeSchema, freeThreshold: freeThresholdSchema }),
  payments: z.object({ cod: toggleSchema, vnpay: toggleSchema, bankTransfer: toggleSchema, momo: toggleSchema }),
  ai: z.object({ search: toggleSchema, chat: toggleSchema, build: toggleSchema }),
});

/* -------------------------------------------------------------------------- */
/*  Ghép dữ liệu trong DB với mặc định                                        */
/* -------------------------------------------------------------------------- */

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** Trường hợp lệ thì lấy, thiếu/sai kiểu (dữ liệu cũ, ai đó sửa tay trong DB) thì dùng mặc định — không bao giờ ném lỗi */
function pick<T>(schema: z.ZodType<T>, raw: unknown, fallback: T): T {
  const parsed = schema.safeParse(raw);
  return parsed.success ? parsed.data : fallback;
}

/**
 * `stored` = { tên nhóm: JSON đọc từ bảng Setting }. Ghép TỪNG TRƯỜNG một (không phải cả nhóm): một trường hỏng
 * không kéo các trường còn lại trong nhóm về mặc định theo.
 */
export function mergeWithDefaults(stored: Partial<Record<string, unknown>>): SystemSettingsDto {
  const store = asRecord(stored.store);
  const shipping = asRecord(stored.shipping);
  const payments = asRecord(stored.payments);
  const ai = asRecord(stored.ai);
  const d = DEFAULT_SETTINGS;

  return {
    store: {
      hotline: pick(hotlineSchema, store.hotline, d.store.hotline),
      supportEmail: pick(supportEmailSchema, store.supportEmail, d.store.supportEmail),
      showroomAddress: pick(showroomAddressSchema, store.showroomAddress, d.store.showroomAddress),
    },
    shipping: {
      flatFee: pick(flatFeeSchema, shipping.flatFee, d.shipping.flatFee),
      freeThreshold: pick(freeThresholdSchema, shipping.freeThreshold, d.shipping.freeThreshold),
    },
    payments: {
      cod: pick(toggleSchema, payments.cod, d.payments.cod),
      vnpay: pick(toggleSchema, payments.vnpay, d.payments.vnpay),
      bankTransfer: pick(toggleSchema, payments.bankTransfer, d.payments.bankTransfer),
      momo: pick(toggleSchema, payments.momo, d.payments.momo),
    },
    ai: {
      search: pick(toggleSchema, ai.search, d.ai.search),
      chat: pick(toggleSchema, ai.chat, d.ai.chat),
      build: pick(toggleSchema, ai.build, d.ai.build),
    },
  };
}

/* -------------------------------------------------------------------------- */
/*  So sánh trước/sau — metadata cho AdminAuditLog                            */
/* -------------------------------------------------------------------------- */

export interface SettingsDiff {
  /** Dạng "nhóm.trường", vd ["shipping.flatFee", "ai.chat"] */
  changedKeys: string[];
  changedGroups: SettingGroup[];
  /** Chỉ gồm các trường có đổi, để nhật ký gọn mà vẫn đủ trước/sau */
  before: Partial<Record<SettingGroup, Record<string, unknown>>>;
  after: Partial<Record<SettingGroup, Record<string, unknown>>>;
}

export function diffSettings(before: SystemSettingsDto, after: SystemSettingsDto): SettingsDiff {
  const diff: SettingsDiff = { changedKeys: [], changedGroups: [], before: {}, after: {} };

  for (const group of SETTING_GROUPS) {
    const oldGroup = before[group] as unknown as Record<string, unknown>;
    const newGroup = after[group] as unknown as Record<string, unknown>;
    for (const field of Object.keys(newGroup)) {
      if (oldGroup[field] === newGroup[field]) continue;
      diff.changedKeys.push(`${group}.${field}`);
      (diff.before[group] ??= {})[field] = oldGroup[field];
      (diff.after[group] ??= {})[field] = newGroup[field];
    }
    if (diff.after[group]) diff.changedGroups.push(group);
  }

  return diff;
}

/* -------------------------------------------------------------------------- */
/*  Phương thức thanh toán                                                    */
/* -------------------------------------------------------------------------- */

export const PAYMENT_METHOD_KEY: Record<PaymentMethodDto, keyof PaymentMethodsDto> = {
  COD: "cod",
  VNPAY: "vnpay",
  BANK_TRANSFER: "bankTransfer",
  MOMO: "momo",
};

export const PAYMENT_METHOD_NAME: Record<keyof PaymentMethodsDto, string> = {
  cod: "Thanh toán khi nhận hàng (COD)",
  vnpay: "VNPay",
  bankTransfer: "Chuyển khoản ngân hàng",
  momo: "Ví MoMo",
};

/** Khách chọn được phương thức nào = chủ website đang BẬT **và** đã cấu hình trong .env (thiếu khoá thì bật cũng vô ích) */
export function availablePaymentMethods(enabled: PaymentToggleSettingsDto, configured: PaymentMethodsDto): PaymentMethodsDto {
  return {
    cod: enabled.cod && configured.cod,
    vnpay: enabled.vnpay && configured.vnpay,
    bankTransfer: enabled.bankTransfer && configured.bankTransfer,
    momo: enabled.momo && configured.momo,
  };
}

/** `null` = phương thức đang bật; ngược lại là câu báo lỗi cho khách (tạo đơn trả 400) */
export function disabledPaymentMessage(enabled: PaymentToggleSettingsDto, method: PaymentMethodDto): string | null {
  const key = PAYMENT_METHOD_KEY[method];
  if (enabled[key]) return null;
  return `Phương thức ${PAYMENT_METHOD_NAME[key]} đang tạm tắt. Vui lòng chọn phương thức thanh toán khác.`;
}

/**
 * Chặn lưu một bộ cài đặt khiến KHÔNG còn phương thức nào dùng được (tắt hết, hoặc chỉ bật đúng những phương thức
 * chưa cấu hình trong .env) — lúc đó khách không thể đặt hàng. `null` = hợp lệ.
 */
export function paymentSettingsProblem(enabled: PaymentToggleSettingsDto, configured: PaymentMethodsDto): string | null {
  const available = availablePaymentMethods(enabled, configured);
  if (Object.values(available).some(Boolean)) return null;
  return "Phải bật ít nhất một phương thức thanh toán đã được cấu hình, nếu không khách sẽ không đặt hàng được.";
}

/* -------------------------------------------------------------------------- */
/*  Tính năng AI                                                              */
/* -------------------------------------------------------------------------- */

export const AI_FEATURE_NAME: Record<AiFeature, string> = {
  search: "Tìm kiếm bằng AI",
  chat: "Trợ lý AI",
  build: "AI gợi ý cấu hình",
};

/** Tính năng DÙNG ĐƯỢC thật = đang bật **và** đã cấu hình khoá AI — trang bán hàng dựa vào đây để hiện thông báo sẵn */
export function availableAiFeatures(enabled: AiToggleSettingsDto, aiConfigured: boolean): AiToggleSettingsDto {
  return {
    search: enabled.search && aiConfigured,
    chat: enabled.chat && aiConfigured,
    build: enabled.build && aiConfigured,
  };
}

export function disabledAiFeatureMessage(feature: AiFeature): string {
  return `Tính năng ${AI_FEATURE_NAME[feature]} đang tạm tắt.`;
}
