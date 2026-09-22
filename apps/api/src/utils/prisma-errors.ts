import { Prisma } from "@pczone/db";

/** P2002 = vi phạm ràng buộc unique. Dùng để phát hiện race condition (hai request cùng tạo một dòng). */
export function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}
