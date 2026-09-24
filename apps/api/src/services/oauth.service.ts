import { Prisma, prisma, type OAuthProvider, type User } from "@pczone/db";
import { ConflictError, NotFoundError, UnauthorizedError } from "../middleware/errors.js";
import {
  createUnusablePasswordHash,
  findActiveUser,
  issueSession,
  type AuthResult,
  type SessionContext,
} from "./auth.service.js";
import { OAuthError, type SocialProfile } from "./oauth.providers.js";

/**
 * Đăng nhập (hoặc tự tạo tài khoản) từ hồ sơ Google / Facebook.
 *
 * Nguyên tắc: tài khoản mạng xã hội được nhận diện bằng (provider, providerAccountId),
 * KHÔNG phải bằng email. Email chỉ được xét khi đây là lần đầu một tài khoản mạng
 * xã hội xuất hiện, và chỉ khi nhà cung cấp bảo đảm email đó đã xác minh.
 *
 *  1. Tài khoản mạng xã hội đã liên kết      -> đăng nhập thẳng vào User đó.
 *  2. Chưa có User nào dùng email này         -> tạo User mới + liên kết.
 *  3. Đã có User dùng email này:
 *     - Nhà cung cấp không bảo đảm email (Facebook) -> TỪ CHỐI. Ai cũng có thể lập
 *       tài khoản Facebook mang email của người khác; gộp vào là mất tài khoản.
 *       Lối ra hợp lệ: đăng nhập bằng cách cũ rồi liên kết tay (xem linkSocialProfile).
 *     - Google (email đã xác minh):
 *         · User đã xác minh email    -> liên kết thêm.
 *         · User CHƯA xác minh email  -> "nhận lại" tài khoản (xem claimUnverifiedUser).
 */
export async function loginWithSocialProfile(
  profile: SocialProfile,
  context: SessionContext,
): Promise<AuthResult> {
  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
      },
    },
    include: { user: true },
  });

  if (linked) {
    assertUsable(linked.user);
    return issueSession(await recordLogin(linked.user, profile), context);
  }

  if (!profile.email) throw new OAuthError("oauth_no_email");

  const existing = await prisma.user.findUnique({ where: { email: profile.email } });

  if (!existing) {
    return issueSession(await createSocialUser(profile, profile.email), context);
  }

  if (!profile.emailVerified) throw new OAuthError("oauth_email_taken");
  assertUsable(existing);

  const user = existing.emailVerifiedAt
    ? await linkToVerifiedUser(existing, profile)
    : await claimUnverifiedUser(existing, profile);

  return issueSession(user, context);
}

/**
 * Người dùng ĐÃ đăng nhập chủ động liên kết thêm một tài khoản Google / Facebook
 * (nút "Liên kết" ở trang Tài khoản).
 *
 * Không đối chiếu email như lúc đăng nhập: người này vừa chứng minh được cả hai bên,
 * gồm phiên PCZone đang mở và tài khoản mạng xã hội vừa quay về, nên email của tài
 * khoản mạng xã hội có khác hay trùng người khác cũng không ảnh hưởng. Đây là lối ra
 * cho lỗi `oauth_email_taken` của Facebook.
 *
 *  - Tài khoản mạng xã hội này đã thuộc User khác  -> oauth_provider_taken
 *  - User đã có liên kết với nhà cung cấp này      -> oauth_already_linked
 *    (mỗi User một tài khoản cho mỗi nhà cung cấp, để giao diện chỉ cần "Đã liên kết" / "Liên kết")
 */
export async function linkSocialProfile(userId: string, profile: SocialProfile): Promise<void> {
  const user = await findActiveUser(userId);
  if (!user) throw new OAuthError("oauth_login_required");

  const [taken, own] = await Promise.all([
    prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
        },
      },
    }),
    prisma.oAuthAccount.findFirst({ where: { userId, provider: profile.provider } }),
  ]);

  if (taken && taken.userId !== userId) throw new OAuthError("oauth_provider_taken");
  if (taken || own) throw new OAuthError("oauth_already_linked");

  try {
    await prisma.oAuthAccount.create({
      data: {
        userId,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
      },
    });
  } catch (error) {
    // Hai lượt liên kết chạy song song: bên thua để người dùng thử lại
    if (isUniqueViolation(error)) throw new OAuthError("oauth_failed");
    throw error;
  }
}

/** Các tài khoản mạng xã hội đã liên kết với một User, cũ nhất trước */
export function listLinkedAccounts(userId: string) {
  return prisma.oAuthAccount.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { provider: true, email: true, createdAt: true },
  });
}

/**
 * Huỷ liên kết một tài khoản mạng xã hội. Chặn khi đây là CÁCH DUY NHẤT người dùng đăng nhập
 * được — liên kết cuối cùng (`accounts.length === 1`) VÀ chưa có mật khẩu thật (`hasPassword`,
 * xem ghi chú ở schema.prisma) — huỷ thì tài khoản mất hẳn đường vào, không ai (kể cả người dùng)
 * tự khôi phục được.
 */
export async function unlinkProvider(userId: string, provider: OAuthProvider): Promise<void> {
  const [user, accounts] = await Promise.all([
    findActiveUser(userId),
    prisma.oAuthAccount.findMany({ where: { userId } }),
  ]);
  if (!user) throw new UnauthorizedError("Bạn chưa đăng nhập");

  const target = accounts.find((account) => account.provider === provider);
  if (!target) throw new NotFoundError("Tài khoản này chưa liên kết với nhà cung cấp đó");

  if (accounts.length === 1 && !user.hasPassword) {
    throw new ConflictError(
      "Đây là cách duy nhất bạn đăng nhập được. Hãy đặt mật khẩu hoặc liên kết thêm một tài khoản khác trước khi huỷ liên kết này.",
    );
  }

  await prisma.oAuthAccount.delete({ where: { id: target.id } });
}

function assertUsable(user: User) {
  if (!user.isActive) throw new OAuthError("oauth_inactive");
}

/** Ảnh đại diện: chỉ nhận https và vừa cột VARCHAR(500) */
function cleanAvatar(url: string | null): string | null {
  return url && url.startsWith("https://") && url.length <= 500 ? url : null;
}

function pickName(profile: SocialProfile, email: string): string {
  const name = (profile.name ?? "").trim().slice(0, 150);
  if (name.length >= 2) return name;

  const fromEmail = email.split("@")[0].slice(0, 150);
  return fromEmail.length >= 2 ? fromEmail : "Thành viên PCZone";
}

/** Ghi nhận lần đăng nhập; chưa có ảnh đại diện thì lấy ảnh của tài khoản mạng xã hội */
function recordLogin(user: User, profile: SocialProfile): Promise<User> {
  return prisma.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      ...(user.avatarUrl ? {} : { avatarUrl: cleanAvatar(profile.avatarUrl) }),
    },
  });
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

async function createSocialUser(profile: SocialProfile, email: string): Promise<User> {
  const passwordHash = await createUnusablePasswordHash();

  try {
    return await prisma.user.create({
      data: {
        email,
        passwordHash,
        hasPassword: false,
        fullName: pickName(profile, email),
        avatarUrl: cleanAvatar(profile.avatarUrl),
        // Chỉ đánh dấu đã xác minh khi nhà cung cấp bảo đảm; Facebook thì để trống
        emailVerifiedAt: profile.emailVerified ? new Date() : null,
        lastLoginAt: new Date(),
        oauthAccounts: {
          create: {
            provider: profile.provider,
            providerAccountId: profile.providerAccountId,
            email,
          },
        },
      },
    });
  } catch (error) {
    // Hai lượt đăng nhập đầu tiên chạy song song: bên thua để người dùng thử lại
    if (isUniqueViolation(error)) throw new OAuthError("oauth_failed");
    throw error;
  }
}

async function linkToVerifiedUser(user: User, profile: SocialProfile): Promise<User> {
  try {
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: profile.provider,
        providerAccountId: profile.providerAccountId,
        email: profile.email,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new OAuthError("oauth_failed");
    throw error;
  }

  return recordLogin(user, profile);
}

/**
 * Tài khoản có sẵn cùng email nhưng email CHƯA từng được xác minh (đăng ký bằng
 * mật khẩu, hệ thống không gửi thư xác minh), còn Google xác nhận người đang đăng
 * nhập thật sự sở hữu email đó.
 *
 * Nếu chỉ liên kết thêm, kẻ xấu đã đăng ký trước bằng email của nạn nhân (kèm mật
 * khẩu của hắn) vẫn giữ được quyền vào tài khoản mà nạn nhân sau này dùng — tấn
 * công "pre-hijacking". Vì vậy tài khoản được trao cho chủ email thật, và mọi
 * thứ kẻ đăng ký trước có thể đang giữ bị huỷ: mật khẩu cũ (thành chuỗi không ai
 * biết), các liên kết mạng xã hội khác, và mọi phiên đăng nhập đang mở.
 *
 * Người dùng thật từng đăng ký bằng mật khẩu rồi bấm "Đăng nhập với Google" cũng
 * đi vào nhánh này: họ vẫn vào được (bằng Google) nhưng mật khẩu cũ không còn dùng nữa.
 */
async function claimUnverifiedUser(user: User, profile: SocialProfile): Promise<User> {
  const passwordHash = await createUnusablePasswordHash();

  try {
    return await prisma.$transaction(async (tx) => {
      await tx.oAuthAccount.deleteMany({ where: { userId: user.id } });
      await tx.refreshToken.deleteMany({ where: { userId: user.id } });
      await tx.oAuthAccount.create({
        data: {
          userId: user.id,
          provider: profile.provider,
          providerAccountId: profile.providerAccountId,
          email: profile.email,
        },
      });

      return tx.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          hasPassword: false,
          emailVerifiedAt: new Date(),
          lastLoginAt: new Date(),
          ...(user.avatarUrl ? {} : { avatarUrl: cleanAvatar(profile.avatarUrl) }),
        },
      });
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new OAuthError("oauth_failed");
    throw error;
  }
}
