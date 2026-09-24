import { prisma } from "@pczone/db";
import { BadRequestError } from "../middleware/errors.js";
import { webUrl } from "../utils/redirect.js";
import { sendVerificationEmail } from "./email.service.js";
import { generateEmailVerificationToken, hashToken } from "./token.service.js";

const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Gửi (hoặc gửi lại) email xác minh cho một user đã biết chắc tồn tại — khác
 * `requestPasswordReset` (phải giấu việc email có tồn tại hay không), hàm này luôn được gọi cho
 * một user đã xác định rồi: lúc vừa đăng ký, hoặc người dùng đã đăng nhập tự bấm "Gửi lại".
 */
export async function sendEmailVerification(user: { id: string; email: string }): Promise<void> {
  const { token, tokenHash } = generateEmailVerificationToken();

  await prisma.$transaction([
    // Yêu cầu mới huỷ các link cũ chưa dùng của chính người này — chỉ link gửi gần nhất còn hiệu lực
    prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.emailVerificationToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
    }),
  ]);

  await sendVerificationEmail(user.email, webUrl("/xac-minh-email", { token }));
}

export async function confirmEmailVerification(token: string): Promise<void> {
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash: hashToken(token) } });

  const invalid = !record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now();
  if (invalid) {
    throw new BadRequestError("Liên kết xác minh không hợp lệ hoặc đã hết hạn. Vui lòng gửi lại email xác minh.");
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);
}
