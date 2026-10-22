/**
 * Kiểm thử mã lỗi API trả về (`errors.ts`): mỗi lớp lỗi con phải ra đúng mã HTTP + đúng mã máy đọc ở trường `error`
 * (trước đây mọi lớp con đều ra "HttpError"). Không cần DB — `errorHandler` chạy trên một `res` giả.
 * Chạy: npx tsx src/middleware/errors.test.ts
 */
import type { NextFunction, Request, Response } from "express";
import { z } from "zod";
import {
  BadRequestError,
  ConflictError,
  errorHandler,
  ForbiddenError,
  HttpError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
} from "./errors.js";

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

/** Chạy `errorHandler` trên một `res` giả, trả mã HTTP + JSON nó ghi ra */
function handle(error: unknown): { status: number; body: Record<string, unknown> } {
  const out = { status: 0, body: {} as Record<string, unknown> };
  const res = {
    status(code: number) {
      out.status = code;
      return this;
    },
    json(body: Record<string, unknown>) {
      out.body = body;
      return this;
    },
  };
  errorHandler(error, {} as Request, res as unknown as Response, (() => {}) as NextFunction);
  return out;
}

console.log("\n[1] Mỗi lớp lỗi con: đúng mã HTTP, đúng mã `error`, giữ thông điệp");
{
  const cases: [HttpError, number, string][] = [
    [new BadRequestError("sai"), 400, "BAD_REQUEST"],
    [new UnauthorizedError("chưa đăng nhập"), 401, "UNAUTHORIZED"],
    [new ForbiddenError("không có quyền"), 403, "FORBIDDEN"],
    [new NotFoundError("không thấy"), 404, "NOT_FOUND"],
    [new ConflictError("xung đột"), 409, "CONFLICT"],
    [new ServiceUnavailableError("dịch vụ lỗi"), 503, "SERVICE_UNAVAILABLE"],
  ];
  for (const [error, status, code] of cases) {
    check(`${error.constructor.name} -> ${status} ${code}`, handle(error), { status, body: { error: code, message: error.message } });
  }
  check("không lớp nào còn trả \"HttpError\"", cases.some(([error]) => handle(error).body.error === "HttpError"), false);
}

console.log("\n[2] Thông điệp mặc định và tên lớp (cho log)");
{
  check("NotFoundError mặc định", handle(new NotFoundError()).body, { error: "NOT_FOUND", message: "Không tìm thấy tài nguyên" });
  check("name là tên lớp con thật", [new NotFoundError().name, new ConflictError().name], ["NotFoundError", "ConflictError"]);
  check("vẫn là HttpError/Error (instanceof)", [new ForbiddenError() instanceof HttpError, new ForbiddenError() instanceof Error], [true, true]);
}

console.log("\n[3] Các nhánh khác của errorHandler giữ nguyên");
{
  const zod = z.object({ email: z.string().email() }).safeParse({ email: "x" });
  const validation = handle(zod.error);
  check("ZodError -> 400 VALIDATION_ERROR kèm details", [validation.status, validation.body.error, (validation.body.details as unknown[]).length], [
    400,
    "VALIDATION_ERROR",
    1,
  ]);
  check("lỗi 413 của express.json -> BAD_REQUEST, quá lớn", handle({ status: 413 }), {
    status: 413,
    body: { error: "BAD_REQUEST", message: "Dữ liệu gửi lên quá lớn" },
  });
  const original = console.error;
  console.error = () => {}; // nhánh 500 in log lỗi — tắt tạm cho gọn kết quả kiểm thử
  const internal = handle(new Error("hỏng"));
  console.error = original;
  check("lỗi không lường trước -> 500 INTERNAL_ERROR", [internal.status, internal.body.error], [500, "INTERNAL_ERROR"]);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
