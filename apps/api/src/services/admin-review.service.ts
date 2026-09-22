import { prisma } from "@pczone/db";
import { adminReviewInclude, toAdminReviewSummaryDto } from "../mappers/review.mapper.js";
import { NotFoundError } from "../middleware/errors.js";
import type { AdminReviewSummaryDto, Paginated } from "../types/dto.js";
import { recomputeProductRating } from "./review.service.js";

export interface AdminReviewFilters {
  isApproved?: boolean;
}

/** `GET /api/admin/reviews` — mặc định liệt kê TẤT CẢ, mới nhất trước; lọc `isApproved` để lấy hàng chờ duyệt */
export async function listReviewsForAdmin(
  filters: AdminReviewFilters,
  page: number,
  pageSize: number,
): Promise<Paginated<AdminReviewSummaryDto>> {
  const where = { isApproved: filters.isApproved };

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: adminReviewInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items: rows.map(toAdminReviewSummaryDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/** Duyệt một đánh giá — hiện công khai ở trang sản phẩm và tính vào rating trung bình từ đây */
export async function approveReview(reviewId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id: reviewId }, select: { productId: true } });
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá");

    await tx.review.update({ where: { id: reviewId }, data: { isApproved: true } });
    await recomputeProductRating(tx, review.productId);
  });
}

/** Xoá một đánh giá (spam / vi phạm) — nếu đang được tính vào rating trung bình thì tính lại sau khi xoá */
export async function deleteReview(reviewId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const review = await tx.review.findUnique({ where: { id: reviewId }, select: { productId: true, isApproved: true } });
    if (!review) throw new NotFoundError("Không tìm thấy đánh giá");

    await tx.review.delete({ where: { id: reviewId } });
    if (review.isApproved) await recomputeProductRating(tx, review.productId);
  });
}

/** Phản hồi công khai của cửa hàng — hiện kèm đánh giá một khi đánh giá đó đã được duyệt */
export async function replyToReview(reviewId: string, reply: string): Promise<void> {
  const result = await prisma.review.updateMany({
    where: { id: reviewId },
    data: { adminReply: reply, adminRepliedAt: new Date() },
  });
  if (result.count === 0) throw new NotFoundError("Không tìm thấy đánh giá");
}
