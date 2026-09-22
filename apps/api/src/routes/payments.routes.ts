import { Router } from "express";
import { env } from "../env.js";
import { applyVnpayCallback, type ApplyVnpayResult } from "../services/order.service.js";
import { isBankTransferConfigured, isMomoConfigured } from "../services/manual-payment.service.js";
import { isVnpayConfigured, verifyCallback, type VerifiedCallback } from "../services/vnpay.service.js";
import { webUrl } from "../utils/redirect.js";

export const paymentsRouter = Router();

/** GET /api/payments/methods — trang đặt hàng dùng để ẩn/khoá phương thức chưa cấu hình (thiếu khoá/số tài khoản) */
paymentsRouter.get("/methods", (_req, res) => {
  res.json({
    cod: true,
    vnpay: isVnpayConfigured(env.vnpay),
    bankTransfer: isBankTransferConfigured(env.bankTransfer),
    momo: isMomoConfigured(env.momo),
  });
});

/**
 * Đích chuyển trình duyệt về sau khi xử lý xong một callback VNPay.
 * `not_found` là trường hợp duy nhất không có đơn hàng để dẫn tới (vnp_TxnRef không khớp Payment nào —
 * chữ ký sai hoặc dữ liệu bị sửa); còn lại luôn có `order.orderCode` để đưa thẳng về trang chi tiết đơn.
 */
function redirectTargetFor(result: ApplyVnpayResult, callback: VerifiedCallback): string {
  if (result.kind === "not_found") {
    return webUrl("/tra-cuu-don-hang", { error: "payment_not_found" });
  }

  const success = result.kind === "amount_mismatch" ? false : result.success;
  const params: Record<string, string> = { pay: success ? "success" : "failed" };
  if (!success && callback.responseCode) params.reason = callback.responseCode;
  return webUrl(`/don-hang/${result.order.orderCode}`, params);
}

/**
 * GET /api/payments/vnpay/return — VNPay chuyển TRÌNH DUYỆT về đây sau khi khách thanh toán xong hoặc huỷ.
 * Chỉ để đưa khách quay lại một trang đẹp; nguồn sự thật đích thực là IPN bên dưới (khách có thể đóng tab
 * trước khi trình duyệt kịp quay về đây, IPN vẫn tới vì VNPay gọi thẳng từ server của họ).
 */
paymentsRouter.get("/vnpay/return", async (req, res) => {
  try {
    const callback = verifyCallback(env.vnpay.hashSecret, req.query as Record<string, unknown>);

    if (!callback.signatureValid) {
      res.redirect(webUrl("/tra-cuu-don-hang", { error: "invalid_signature" }));
      return;
    }

    const result = await applyVnpayCallback(callback);
    res.redirect(redirectTargetFor(result, callback));
  } catch (error) {
    console.error("Lỗi xử lý VNPay return:", error);
    res.redirect(webUrl("/tra-cuu-don-hang", { error: "payment_error" }));
  }
});

/**
 * GET /api/payments/vnpay/ipn — VNPay gọi thẳng từ SERVER của họ (không qua trình duyệt khách), độc lập với
 * việc khách có quay lại trang return hay không. Phải trả đúng JSON `{RspCode, Message}` theo tài liệu
 * VNPay — không phải trang HTML — nên không dùng `errorHandler` chung của app.
 */
paymentsRouter.get("/vnpay/ipn", async (req, res) => {
  try {
    const callback = verifyCallback(env.vnpay.hashSecret, req.query as Record<string, unknown>);
    if (!callback.signatureValid) {
      res.json({ RspCode: "97", Message: "Invalid signature" });
      return;
    }

    const result = await applyVnpayCallback(callback);
    switch (result.kind) {
      case "not_found":
        res.json({ RspCode: "01", Message: "Order not found" });
        return;
      case "amount_mismatch":
        res.json({ RspCode: "04", Message: "Invalid amount" });
        return;
      case "already_processed":
        res.json({ RspCode: "02", Message: "Order already confirmed" });
        return;
      case "applied":
        res.json({ RspCode: "00", Message: "Confirm Success" });
        return;
    }
  } catch (error) {
    console.error("Lỗi xử lý VNPay IPN:", error);
    res.json({ RspCode: "99", Message: "Unknown error" });
  }
});
