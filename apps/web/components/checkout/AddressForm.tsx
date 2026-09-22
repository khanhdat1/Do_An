"use client";

import { useState } from "react";
import { LoaderCircle, MapPin, Phone, UserRound } from "lucide-react";
import FormError from "@/components/auth/FormError";
import TextField from "@/components/ui/TextField";
import { apiFetch, ApiError, errorMessage } from "@/lib/api-client";
import { focusField } from "@/lib/forms";
import type { Address } from "@/types";

type Field = "recipientName" | "phone" | "province" | "district" | "ward" | "streetAddress";
type FieldErrors = Partial<Record<Field, string>>;

const FIELD_ORDER: Field[] = ["recipientName", "phone", "province", "district", "ward", "streetAddress"];
const PHONE_PATTERN = /^(0|\+84)\d{9,10}$/;

const EMPTY: Record<Field, string> = {
  recipientName: "",
  phone: "",
  province: "",
  district: "",
  ward: "",
  streetAddress: "",
};

/** Khớp luật ở `addressInputSchema` của API — chỉ để báo lỗi ngay lúc gõ, API vẫn kiểm tra lại */
function validate(values: Record<Field, string>): FieldErrors {
  const found: FieldErrors = {};
  if (values.recipientName.trim().length < 2) found.recipientName = "Tên quá ngắn";

  const phone = values.phone.replace(/[\s.-]/g, "");
  if (!phone) found.phone = "Vui lòng nhập số điện thoại";
  else if (!PHONE_PATTERN.test(phone)) found.phone = "Số điện thoại không hợp lệ";

  if (!values.province.trim()) found.province = "Vui lòng nhập tỉnh/thành phố";
  if (!values.district.trim()) found.district = "Vui lòng nhập quận/huyện";
  if (!values.ward.trim()) found.ward = "Vui lòng nhập phường/xã";
  if (values.streetAddress.trim().length < 3) found.streetAddress = "Vui lòng nhập số nhà, tên đường";

  return found;
}

interface AddressFormProps {
  /** Chưa có địa chỉ nào trong sổ: tự đặt làm mặc định, không hiện ô chọn lẫn nút "Huỷ" */
  isFirstAddress: boolean;
  onCreated: (address: Address) => void;
  /** Ẩn khi đây là địa chỉ đầu tiên — không có gì để quay lại */
  onCancel?: () => void;
}

/** Form thêm địa chỉ mới, lưu thẳng vào sổ địa chỉ (`POST /api/addresses`) rồi báo lên cho nơi gọi */
export default function AddressForm({ isFirstAddress, onCreated, onCancel }: AddressFormProps) {
  const [values, setValues] = useState<Record<Field, string>>(EMPTY);
  const [saveAsDefault, setSaveAsDefault] = useState(!isFirstAddress);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function bind(field: Field) {
    return {
      name: field,
      value: values[field],
      error: errors[field],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        setValues((current) => ({ ...current, [field]: event.target.value })),
    };
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    const form = event.currentTarget;
    const found = validate(values);
    setErrors(found);
    setFormError(null);

    const firstInvalid = FIELD_ORDER.find((field) => found[field]);
    if (firstInvalid) {
      focusField(form, firstInvalid);
      return;
    }

    setSubmitting(true);
    try {
      const address = await apiFetch<Address>("/api/addresses", {
        method: "POST",
        body: {
          recipientName: values.recipientName.trim(),
          phone: values.phone.replace(/[\s.-]/g, ""),
          province: values.province.trim(),
          district: values.district.trim(),
          ward: values.ward.trim(),
          streetAddress: values.streetAddress.trim(),
          isDefault: isFirstAddress || saveAsDefault,
        },
      });
      onCreated(address);
    } catch (error) {
      if (error instanceof ApiError && Object.keys(error.fieldErrors).length > 0) {
        const mapped: FieldErrors = {
          recipientName: error.fieldErrors.recipientName,
          phone: error.fieldErrors.phone,
          province: error.fieldErrors.province,
          district: error.fieldErrors.district,
          ward: error.fieldErrors.ward,
          streetAddress: error.fieldErrors.streetAddress,
        };
        setErrors(mapped);
        focusField(form, FIELD_ORDER.find((field) => mapped[field]) ?? "recipientName");
      } else {
        setFormError(errorMessage(error));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 p-4">
      <TextField
        {...bind("recipientName")}
        label="Tên người nhận"
        required
        autoComplete="name"
        placeholder="Nguyễn Văn A"
        icon={<UserRound className="size-4.5" />}
      />

      <TextField
        {...bind("phone")}
        label="Số điện thoại"
        required
        type="tel"
        autoComplete="tel"
        inputMode="tel"
        placeholder="0912 345 678"
        icon={<Phone className="size-4.5" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <TextField {...bind("province")} label="Tỉnh/Thành phố" required placeholder="Hà Nội" />
        <TextField {...bind("district")} label="Quận/Huyện" required placeholder="Cầu Giấy" />
        <TextField {...bind("ward")} label="Phường/Xã" required placeholder="Dịch Vọng" />
      </div>

      <TextField
        {...bind("streetAddress")}
        label="Số nhà, tên đường"
        required
        placeholder="Số 1, ngõ 2, đường Xuân Thuỷ"
        icon={<MapPin className="size-4.5" />}
      />

      {isFirstAddress ? null : (
        <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={saveAsDefault}
            onChange={(event) => setSaveAsDefault(event.target.checked)}
            className="size-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
          />
          Đặt làm địa chỉ mặc định
        </label>
      )}

      {formError ? <FormError message={formError} /> : null}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="flex h-11 items-center gap-2 rounded-lg bg-brand-500 px-5 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {submitting ? <LoaderCircle className="size-4.5 animate-spin" /> : null}
          {submitting ? "Đang lưu..." : "Lưu địa chỉ"}
        </button>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="text-sm font-semibold text-slate-500 hover:text-slate-700 disabled:opacity-50"
          >
            Huỷ
          </button>
        ) : null}
      </div>
    </form>
  );
}
