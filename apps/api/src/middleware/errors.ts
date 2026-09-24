import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../env.js";

/** Lỗi có mã HTTP đi kèm, để controller ném ra thay vì tự res.status() */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Không tìm thấy tài nguyên") {
    super(404, message);
  }
}

export class BadRequestError extends HttpError {
  constructor(message = "Dữ liệu gửi lên không hợp lệ") {
    super(400, message);
  }
}

/** Chưa đăng nhập, token sai hoặc hết hạn */
export class UnauthorizedError extends HttpError {
  constructor(message = "Bạn cần đăng nhập để thực hiện thao tác này") {
    super(401, message);
  }
}

/** Đã đăng nhập nhưng không được phép (tài khoản bị khoá, sai quyền...) */
export class ForbiddenError extends HttpError {
  constructor(message = "Bạn không có quyền thực hiện thao tác này") {
    super(403, message);
  }
}

/** Xung đột trạng thái: email đã tồn tại, hết hàng, vượt tồn kho... */
export class ConflictError extends HttpError {
  constructor(message = "Yêu cầu xung đột với trạng thái hiện tại") {
    super(409, message);
  }
}

/** Một dịch vụ ngoài (gửi email...) từ chối/không phản hồi — khác lỗi 500 chung chung, người dùng biết rõ nên làm gì tiếp (thử lại sau) */
export class ServiceUnavailableError extends HttpError {
  constructor(message = "Dịch vụ tạm thời không khả dụng, vui lòng thử lại sau") {
    super(503, message);
  }
}

function isClientError(error: unknown): error is { status: number } {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof error.status === "number" &&
    error.status >= 400 &&
    error.status < 500
  );
}

/** 404 cho route không khớp */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    error: "NOT_FOUND",
    message: `Không có endpoint ${req.method} ${req.originalUrl}`,
  });
}

/**
 * Bộ xử lý lỗi cuối cùng. Express 5 tự bắt cả lỗi từ async handler,
 * nhưng vẫn giữ next(error) trong route cho rõ ràng.
 */
export function errorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      message: "Tham số không hợp lệ",
      details: error.issues.map((issue) => ({
        field: issue.path.join("."),
        message: issue.message,
      })),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.name, message: error.message });
    return;
  }

  // Lỗi 4xx do express.json() ném ra: JSON sai cú pháp, body quá lớn...
  if (isClientError(error)) {
    const tooLarge = error.status === 413;
    res.status(error.status).json({
      error: "BAD_REQUEST",
      message: tooLarge
        ? "Dữ liệu gửi lên quá lớn"
        : "Dữ liệu gửi lên không đúng định dạng JSON",
    });
    return;
  }

  console.error("Lỗi không lường trước:", error);
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "Lỗi máy chủ. Xem log của API để biết chi tiết.",
    // Chỉ lộ chi tiết khi chạy dev
    ...(env.isDev && error instanceof Error ? { detail: error.message } : {}),
  });
}
