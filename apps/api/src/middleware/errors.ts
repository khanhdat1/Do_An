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

  console.error("Lỗi không lường trước:", error);
  res.status(500).json({
    error: "INTERNAL_ERROR",
    message: "Lỗi máy chủ. Xem log của API để biết chi tiết.",
    // Chỉ lộ chi tiết khi chạy dev
    ...(env.isDev && error instanceof Error ? { detail: error.message } : {}),
  });
}
