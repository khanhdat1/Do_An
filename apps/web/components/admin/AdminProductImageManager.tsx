"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, ImagePlus, LoaderCircle, Star, Trash2, TriangleAlert, Upload, X } from "lucide-react";
import AdminBadge from "@/components/admin/AdminBadge";
import ProductThumb from "@/components/product/ProductThumb";
import { useToast } from "@/components/providers/ToastProvider";
import { adminApiFetch, errorMessage, uploadAdminProductImages } from "@/lib/admin-api-client";
import {
  addToSelection,
  fileKey,
  formatFileSize,
  moveItem,
  PRODUCT_IMAGE_ACCEPT,
  PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD,
  PRODUCT_IMAGE_MAX_PER_PRODUCT,
} from "@/lib/product-images";
import { cn } from "@/lib/utils";
import type { AdminProductDetail, AdminProductImage } from "@/types";

interface PendingImage {
  key: string;
  file: File;
  /** URL tạm (`blob:`) để xem trước trước khi tải lên — thu hồi khi bỏ khỏi danh sách */
  previewUrl: string;
}

const HEADING_ID = "product-images-heading";
const imageButtonId = (image: AdminProductImage, action: "earlier" | "later" | "delete" | "confirm-delete") =>
  `product-image-${image.id}-${action}`;

function sourceLabel(image: AdminProductImage): string {
  if (image.source === "MANUAL") return "Tải lên từ trang quản trị";
  return image.source ? `Nguồn: ${image.source}` : "Không rõ nguồn";
}

function IconButton({
  id,
  label,
  disabled,
  onClick,
  className,
  children,
}: {
  id?: string;
  label: string;
  disabled?: boolean;
  onClick: () => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "grid size-8 place-items-center rounded-lg border border-slate-200 text-slate-600 transition hover:border-brand-300 hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Khu quản lý ảnh của trang sửa sản phẩm: xem mọi ảnh (kể cả ảnh crawler đang chờ duyệt), đổi thứ tự, đặt ảnh chính,
 * xoá, và chọn/kéo thả ảnh mới → xem trước → tải lên. Mỗi thao tác gọi API ngay (giống đổi trạng thái/tồn kho), không
 * phụ thuộc nút "Lưu thay đổi" của form thông tin. Ảnh chính luôn là ảnh đầu tiên khách nhìn thấy được.
 */
export default function AdminProductImageManager({
  product,
  canWrite,
  onUpdated,
}: {
  product: AdminProductDetail;
  canWrite: boolean;
  onUpdated: (product: AdminProductDetail) => void;
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingImage[]>([]);
  const [selectionErrors, setSelectionErrors] = useState<string[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busyImageId, setBusyImageId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const images = product.images;
  const busy = uploading || busyImageId !== null;
  const full = images.length >= PRODUCT_IMAGE_MAX_PER_PRODUCT;

  /*
   * Giữ tiêu điểm bàn phím sau mỗi thao tác: nút vừa bấm bị vô hiệu hoá trong lúc chờ API (hoặc biến mất — ảnh vừa xoá,
   * ảnh vừa thành ảnh chính), không đặt lại thì tiêu điểm rơi về đầu trang. Lấy nút đầu tiên còn bấm được trong danh sách.
   */
  const focusQueue = useRef<string[]>([]);
  function focusAfterUpdate(...ids: string[]) {
    focusQueue.current = [...ids, HEADING_ID];
  }
  useEffect(() => {
    if (focusQueue.current.length === 0 || busyImageId !== null) return;
    for (const id of focusQueue.current) {
      const element = document.getElementById(id);
      if (element && !(element instanceof HTMLButtonElement && element.disabled)) {
        element.focus();
        break;
      }
    }
    focusQueue.current = [];
  }, [images, busyImageId, confirmDeleteId]);

  // URL xem trước (`blob:`) giữ bộ nhớ tới khi thu hồi — thu hồi khi bỏ khỏi danh sách, và nốt phần còn lại khi rời trang
  const previewUrls = useRef(new Set<string>());
  useEffect(() => {
    const urls = previewUrls.current;
    return () => {
      for (const url of urls) URL.revokeObjectURL(url);
    };
  }, []);
  function createPreview(file: File): string {
    const url = URL.createObjectURL(file);
    previewUrls.current.add(url);
    return url;
  }
  function revokePreview(url: string) {
    URL.revokeObjectURL(url);
    previewUrls.current.delete(url);
  }

  function addFiles(files: File[]) {
    if (files.length === 0) return;
    const { accepted, errors } = addToSelection(
      pending.map((item) => item.file),
      files,
      images.length,
    );
    setSelectionErrors(errors);
    setUploadError(null);
    if (accepted.length > 0) {
      setPending((current) => [...current, ...accepted.map((file) => ({ key: fileKey(file), file, previewUrl: createPreview(file) }))]);
    }
  }

  function removePending(item: PendingImage) {
    revokePreview(item.previewUrl);
    setPending((current) => current.filter((other) => other.key !== item.key));
    setUploadError(null);
  }

  function clearPending() {
    for (const item of pending) revokePreview(item.previewUrl);
    setPending([]);
    setSelectionErrors([]);
    setUploadError(null);
  }

  async function upload() {
    if (pending.length === 0) return;
    setUploading(true);
    setUploadError(null);
    try {
      const updated = await uploadAdminProductImages(
        product.id,
        pending.map((item) => item.file),
      );
      onUpdated(updated);
      toast.success(`Đã tải lên ${pending.length} ảnh`);
      clearPending();
    } catch (error) {
      setUploadError(errorMessage(error));
    } finally {
      setUploading(false);
    }
  }

  async function runImageAction(image: AdminProductImage, request: () => Promise<AdminProductDetail>, success: string) {
    setBusyImageId(image.id);
    try {
      onUpdated(await request());
      toast.success(success);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusyImageId(null);
    }
  }

  function move(index: number, step: -1 | 1) {
    const image = images[index];
    const imageIds = moveItem(
      images.map((other) => other.id),
      index,
      index + step,
    );
    focusAfterUpdate(imageButtonId(image, step < 0 ? "earlier" : "later"), imageButtonId(image, step < 0 ? "later" : "earlier"));
    void runImageAction(
      image,
      () => adminApiFetch<AdminProductDetail>(`/api/admin/products/${product.id}/images/order`, { method: "PUT", body: { imageIds } }),
      `Đã chuyển ảnh ${index + 1} ${step < 0 ? "lên trước" : "ra sau"}`,
    );
  }

  function setPrimary(image: AdminProductImage) {
    focusAfterUpdate(imageButtonId(image, "later"));
    void runImageAction(
      image,
      () => adminApiFetch<AdminProductDetail>(`/api/admin/products/${product.id}/images/${image.id}/primary`, { method: "PATCH" }),
      "Đã đặt làm ảnh chính",
    );
  }

  function askDelete(image: AdminProductImage) {
    setConfirmDeleteId(image.id);
    focusAfterUpdate(imageButtonId(image, "confirm-delete"));
  }

  function cancelDelete(image: AdminProductImage) {
    setConfirmDeleteId(null);
    focusAfterUpdate(imageButtonId(image, "delete"));
  }

  function remove(image: AdminProductImage, index: number) {
    // Ảnh kế tiếp (hoặc ảnh liền trước nếu xoá ảnh cuối) nhận tiêu điểm
    const neighbour = images[index + 1] ?? images[index - 1];
    focusAfterUpdate(...(neighbour ? [imageButtonId(neighbour, "delete")] : []));
    void runImageAction(
      image,
      () => adminApiFetch<AdminProductDetail>(`/api/admin/products/${product.id}/images/${image.id}`, { method: "DELETE" }),
      "Đã xoá ảnh",
    ).then(() => setConfirmDeleteId(null));
  }

  const errors = uploadError ? [uploadError] : selectionErrors;

  return (
    <section className="admin-card p-4 sm:p-5" aria-labelledby={HEADING_ID}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id={HEADING_ID} tabIndex={-1} className="text-base font-bold text-slate-900 outline-none">
          Ảnh sản phẩm
        </h2>
        <span className="text-xs text-slate-500">
          {images.length}/{PRODUCT_IMAGE_MAX_PER_PRODUCT} ảnh
        </span>
      </div>

      {images.length > 0 ? (
        <ol aria-label="Ảnh sản phẩm theo thứ tự hiển thị" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {images.map((image, index) => (
            <li
              key={image.id}
              className={cn(
                "flex flex-col rounded-lg border bg-white p-2",
                image.isPrimary ? "border-brand-400 ring-2 ring-brand-500/20" : "border-slate-200",
              )}
            >
              <div className="relative">
                <ProductThumb name={`Ảnh ${index + 1}: ${image.alt}`} image={image.url} sizes="180px" className="aspect-square" />
                <div className="absolute left-1.5 top-1.5 flex flex-col items-start gap-1">
                  {image.isPrimary ? (
                    <AdminBadge tone="blue" className="gap-1">
                      <Star className="size-3" aria-hidden />
                      Ảnh chính
                    </AdminBadge>
                  ) : null}
                  {image.needsReview ? <AdminBadge tone="amber">Chờ duyệt — khách không thấy</AdminBadge> : null}
                </div>
              </div>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                Ảnh {index + 1} · {sourceLabel(image)}
                {image.bytes ? ` · ${formatFileSize(image.bytes)}` : ""}
              </p>

              {canWrite ? (
                confirmDeleteId === image.id ? (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-slate-600">Xoá hẳn ảnh này?</span>
                    <button
                      id={imageButtonId(image, "confirm-delete")}
                      type="button"
                      onClick={() => remove(image, index)}
                      disabled={busy}
                      className="rounded-lg bg-sale-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-sale-700 disabled:opacity-60"
                    >
                      {busyImageId === image.id ? "Đang xoá..." : "Xoá"}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelDelete(image)}
                      disabled={busy}
                      className="text-xs font-semibold text-slate-500 hover:underline"
                    >
                      Không
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <IconButton
                      id={imageButtonId(image, "earlier")}
                      label={`Chuyển ảnh ${index + 1} lên trước`}
                      disabled={busy || index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ChevronLeft className="size-4" />
                    </IconButton>
                    <IconButton
                      id={imageButtonId(image, "later")}
                      label={`Chuyển ảnh ${index + 1} ra sau`}
                      disabled={busy || index === images.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ChevronRight className="size-4" />
                    </IconButton>
                    {!image.isPrimary && !image.needsReview ? (
                      <IconButton label={`Đặt ảnh ${index + 1} làm ảnh chính`} disabled={busy} onClick={() => setPrimary(image)}>
                        <Star className="size-4" />
                      </IconButton>
                    ) : null}
                    <IconButton
                      id={imageButtonId(image, "delete")}
                      label={`Xoá ảnh ${index + 1}`}
                      disabled={busy}
                      onClick={() => askDelete(image)}
                      className="ml-auto text-sale-600 hover:border-sale-300 hover:bg-sale-500/5"
                    >
                      {busyImageId === image.id ? <LoaderCircle className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                    </IconButton>
                  </div>
                )
              ) : null}
            </li>
          ))}
        </ol>
      ) : (
        <div className="flex flex-col items-center py-6 text-center text-slate-500">
          <ImageOff className="size-8" aria-hidden />
          <p className="mt-2 text-sm">Chưa có ảnh nào</p>
        </div>
      )}

      {canWrite ? (
        <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
          <div
            onDragEnter={(event) => {
              event.preventDefault();
              if (!full && !uploading) setDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);
            }}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              if (!full && !uploading) addFiles(Array.from(event.dataTransfer.files));
            }}
            className={cn(
              "flex flex-col items-center rounded-xl border-2 border-dashed px-4 py-6 text-center transition",
              dragging ? "border-brand-500 bg-brand-500/5" : "border-slate-200 bg-slate-50",
            )}
          >
            <ImagePlus className="size-7 text-slate-500" aria-hidden />
            <p className="mt-2 text-sm font-semibold text-slate-700">Kéo thả ảnh vào đây, hoặc</p>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={full || uploading}
              className="mt-2 flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-300 hover:bg-brand-500/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Upload className="size-3.5" aria-hidden />
              Chọn ảnh từ máy
            </button>
            <p id="product-image-rules" className="mt-2 text-xs text-slate-500">
              {full
                ? `Sản phẩm đã đủ ${PRODUCT_IMAGE_MAX_PER_PRODUCT} ảnh — xoá bớt ảnh cũ để thêm ảnh mới.`
                : `JPEG, PNG hoặc WEBP · tối đa 5 MB mỗi ảnh · tối đa ${PRODUCT_IMAGE_MAX_FILES_PER_UPLOAD} ảnh mỗi lượt, ${PRODUCT_IMAGE_MAX_PER_PRODUCT} ảnh mỗi sản phẩm`}
            </p>
            <input
              ref={inputRef}
              id="product-image-files"
              type="file"
              multiple
              accept={PRODUCT_IMAGE_ACCEPT}
              aria-label="Chọn ảnh sản phẩm để tải lên"
              aria-describedby="product-image-rules"
              onChange={(event) => {
                addFiles(Array.from(event.target.files ?? []));
                // Cho phép chọn lại đúng tệp vừa bỏ khỏi danh sách
                event.target.value = "";
              }}
              className="hidden"
            />
          </div>

          {errors.length > 0 ? (
            <div role="alert" className="rounded-lg border border-sale-500/30 bg-sale-500/5 p-3 text-xs text-sale-700">
              <p className="flex items-center gap-1.5 font-bold">
                <TriangleAlert className="size-3.5 shrink-0" aria-hidden />
                {uploadError ? "Chưa tải ảnh lên được" : "Có tệp không được nhận"}
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5">
                {errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {pending.length > 0 ? (
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-600">Chờ tải lên ({pending.length} ảnh)</p>
              <ul aria-label="Ảnh chờ tải lên" className="grid grid-cols-3 gap-2 sm:grid-cols-5">
                {pending.map((item) => (
                  <li key={item.key} className="relative rounded-lg border border-slate-200 bg-white p-1.5">
                    <div className="relative aspect-square overflow-hidden rounded-md bg-white">
                      <Image src={item.previewUrl} alt={`Xem trước ${item.file.name}`} fill unoptimized sizes="120px" className="object-contain" />
                    </div>
                    <p className="mt-1 truncate text-[11px] font-medium text-slate-700" title={item.file.name}>
                      {item.file.name}
                    </p>
                    <p className="text-[11px] text-slate-500">{formatFileSize(item.file.size)}</p>
                    <button
                      type="button"
                      onClick={() => removePending(item)}
                      disabled={uploading}
                      aria-label={`Bỏ ${item.file.name} khỏi danh sách chờ tải lên`}
                      title="Bỏ khỏi danh sách"
                      className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-white/90 text-slate-600 shadow ring-1 ring-slate-200 transition hover:text-sale-600 disabled:opacity-50"
                    >
                      <X className="size-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={upload}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg bg-brand-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {uploading ? <LoaderCircle className="size-4 animate-spin" /> : <Upload className="size-4" aria-hidden />}
                  {uploading ? "Đang tải lên..." : `Tải lên ${pending.length} ảnh`}
                </button>
                <button type="button" onClick={clearPending} disabled={uploading} className="text-xs font-semibold text-slate-500 hover:underline disabled:opacity-50">
                  Bỏ chọn tất cả
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Bạn chỉ có quyền xem, không có quyền thêm/xoá/sắp xếp ảnh.</p>
      )}

      <p className="mt-3 text-xs text-slate-500">
        Ảnh chính là ảnh đầu tiên khách nhìn thấy được, dùng làm ảnh đại diện ở danh sách sản phẩm. Mọi thay đổi ảnh được lưu
        ngay; trang bán hàng cập nhật trong khoảng 1 phút.
      </p>
    </section>
  );
}
