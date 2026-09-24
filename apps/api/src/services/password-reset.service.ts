import bcrypt from "bcryptjs";
import { prisma } from "@pczone/db";
import { BadRequestError } from "../middleware/errors.js";
import { webUrl } from "../utils/redirect.js";
import { BCRYPT_COST } from "./auth.service.js";
import { sendPasswordResetEmail } from "./email.service.js";
import { generatePasswordResetToken, hashToken } from "./token.service.js";

const RESET_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Không để lộ email nào đã đăng ký: khi email không tồn tại (hoặc tài khoản đã khoá) hàm này
 * lặng lẽ không làm gì — route gọi hàm này LUÔN trả về cùng một thông điệp bất kể có gửi hay không.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return;

  const { token, tokenHash } = generatePasswordResetToken();

  await prisma.$transaction([
    // Yêu cầu mới huỷ các link cũ chưa dùng của chính người này — chỉ link gửi gần nhất còn hiệu lực
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS) },
    }),
  ]);

  await sendPasswordResetEmail(user.email, webUrl("/dat-lai-mat-khau", { token }));
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });

  const invalid = !record || record.usedAt !== null || record.expiresAt.getTime() <= Date.now();
  if (invalid) {
    throw new BadRequestError("Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu lại.");
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash, hasPassword: true } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    // Mật khẩu vừa đổi: đăng xuất khỏi MỌI thiết bị, kể cả thiết bị của kẻ có thể đã biết mật khẩu cũ
    prisma.refreshToken.deleteMany({ where: { userId: record.userId } }),
  ]);
}
