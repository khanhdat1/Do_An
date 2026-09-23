import type { Banner } from "@pczone/db";
import type { AdminBannerDto, BannerDto } from "../types/dto.js";

export function toBannerDto(banner: Banner): BannerDto {
  return {
    id: banner.id,
    title: banner.title ?? undefined,
    subtitle: banner.subtitle ?? undefined,
    imageUrl: banner.imageUrl,
    linkUrl: banner.linkUrl ?? undefined,
  };
}

export function toAdminBannerDto(banner: Banner): AdminBannerDto {
  return {
    id: banner.id,
    title: banner.title ?? undefined,
    subtitle: banner.subtitle ?? undefined,
    imageUrl: banner.imageUrl,
    linkUrl: banner.linkUrl ?? undefined,
    displayOrder: banner.displayOrder,
    status: banner.status,
    startsAt: banner.startsAt?.toISOString(),
    endsAt: banner.endsAt?.toISOString(),
    createdAt: banner.createdAt.toISOString(),
  };
}
