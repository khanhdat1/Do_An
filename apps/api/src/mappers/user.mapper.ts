import type { OAuthProvider, User } from "@pczone/db";
import type { AuthUserDto, LinkedProviderDto } from "../types/dto.js";

/** Chọn lọc từng trường một: thêm cột nhạy cảm vào User cũng không thể vô tình lộ ra ngoài. */
export function toAuthUserDto(user: User): AuthUserDto {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    phone: user.phone ?? undefined,
    avatarUrl: user.avatarUrl ?? undefined,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  };
}

const PROVIDER_KEY: Record<OAuthProvider, LinkedProviderDto["provider"]> = {
  GOOGLE: "google",
  FACEBOOK: "facebook",
};

/** Không lộ `providerAccountId` (mã nội bộ của Google / Facebook) ra frontend */
export function toLinkedProviderDto(account: {
  provider: OAuthProvider;
  email: string | null;
  createdAt: Date;
}): LinkedProviderDto {
  return {
    provider: PROVIDER_KEY[account.provider],
    email: account.email ?? undefined,
    linkedAt: account.createdAt.toISOString(),
  };
}
