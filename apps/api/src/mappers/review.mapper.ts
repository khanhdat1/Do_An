import type { Prisma, Review } from "@pczone/db";
import type { AdminReviewSummaryDto, ReviewDto } from "../types/dto.js";

export const reviewInclude = {
  user: { select: { fullName: true, avatarUrl: true } },
} satisfies Prisma.ReviewInclude;

export type ReviewWithUser = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

function readImages(value: Review["images"]): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const urls = value.filter((item): item is string => typeof item === "string");
  return urls.length > 0 ? urls : undefined;
}

export function toReviewDto(review: ReviewWithUser): ReviewDto {
  return {
    id: review.id,
    rating: review.rating,
    title: review.title ?? undefined,
    content: review.content ?? undefined,
    images: readImages(review.images),
    isVerified: review.isVerified,
    reviewerName: review.user.fullName,
    reviewerAvatarUrl: review.user.avatarUrl ?? undefined,
    adminReply: review.adminReply ?? undefined,
    adminRepliedAt: review.adminRepliedAt?.toISOString(),
    createdAt: review.createdAt.toISOString(),
  };
}

export const adminReviewInclude = {
  user: { select: { fullName: true } },
  product: { select: { slug: true, name: true } },
} satisfies Prisma.ReviewInclude;

export type AdminReviewRow = Prisma.ReviewGetPayload<{ include: typeof adminReviewInclude }>;

export function toAdminReviewSummaryDto(review: AdminReviewRow): AdminReviewSummaryDto {
  return {
    id: review.id,
    productSlug: review.product.slug,
    productName: review.product.name,
    rating: review.rating,
    title: review.title ?? undefined,
    content: review.content ?? undefined,
    isApproved: review.isApproved,
    isVerified: review.isVerified,
    reviewerName: review.user.fullName,
    adminReply: review.adminReply ?? undefined,
    createdAt: review.createdAt.toISOString(),
  };
}
