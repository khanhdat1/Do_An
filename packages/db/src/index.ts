import { PrismaClient } from "@prisma/client";

/**
 * Prisma Client dùng chung cho cả monorepo.
 *
 * Giữ một instance duy nhất trong `globalThis` để khi Next.js hot-reload
 * (dev mode chạy lại module liên tục) không tạo ra hàng chục connection pool
 * rồi làm MySQL báo "Too many connections".
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "warn", "error"]
        : ["warn", "error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

// Re-export toàn bộ type, enum và namespace Prisma để api/crawler chỉ cần
// import từ "@pczone/db", không phải phụ thuộc trực tiếp @prisma/client.
export * from "@prisma/client";
