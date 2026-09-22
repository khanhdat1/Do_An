import { prisma, type Prisma } from "@pczone/db";
import { reviewInclude, toReviewDto } from "../mappers/review.mapper.js";
import { BadRequestError, ConflictError, NotFoundError } from "../middleware/errors.js";
import type { Paginated, ReviewDto, ReviewEligibilityDto } from "../types/dto.js";

/** `Prisma.TransactionClient` là kiểu con của `PrismaClient` nên nhận cả hai — xem address.service.ts */
type Db = Prisma.TransactionClient;

/** 1..5 — MySQL không có CHECK qua Prisma nên phải tự kiểm ở đây (đúng ghi chú trong schema.prisma) */
export function isValidRating(rating: number): boolean {
  return Number.isInteger(rating) && rating >= 1 && rating <= 5;
}

async function resolveActiveProductId(productSlug: string): Promise<string> {
  const product = await prisma.product.findFirst({
    where: { slug: productSlug, status: "ACTIVE" },
    select: { id: true },
  });
  if (!product) throw new NotFoundError("Không tìm thấy sản phẩm");
  return product.id;
}

/**
 * Đơn đã thanh toán (paymentStatus=PAID) chứa sản phẩm này mà CHƯA dùng để đánh giá lần nào —
 * một người mua sản phẩm này ở nhiều đơn khác nhau thì đánh giá được từng đó lần (đúng
 * @@unique([productId, userId, orderId]) trong schema), nhưng mỗi đơn chỉ đánh giá được một lần.
 */
async function findUnusedEligibleOrderId(userId: string, productId: string): Promise<string | null> {
  const [orders, usedReviews] = await Promise.all([
    prisma.order.findMany({
      where: { userId, paymentStatus: "PAID", items: { some: { productId } } },
      select: { id: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.review.findMany({ where: { userId, productId }, select: { orderId: true } }),
  ]);

  const usedOrderIds = new Set(usedReviews.map((row) => row.orderId));
  return orders.find((order) => !usedOrderIds.has(order.id))?.id ?? null;
}

/** `GET /api/products/:slug/reviews/eligibility` — trang sản phẩm dùng để hiện/ẩn form viết đánh giá */
export async function getReviewEligibility(userId: string, productSlug: string): Promise<ReviewEligibilityDto> {
  const productId = await resolveActiveProductId(productSlug);
  const [eligibleOrderId, reviewCount] = await Promise.all([
    findUnusedEligibleOrderId(userId, productId),
    prisma.review.count({ where: { userId, productId } }),
  ]);
  return { canReview: eligibleOrderId !== null, hasReviewed: reviewCount > 0 };
}

export interface CreateReviewInput {
  rating: number;
  title?: string;
  content?: string;
}

export async function createReview(userId: string, productSlug: string, input: CreateReviewInput): Promise<ReviewDto> {
  if (!isValidRating(input.rating)) throw new BadRequestError("Số sao đánh giá phải từ 1 đến 5");

  const productId = await resolveActiveProductId(productSlug);
  const orderId = await findUnusedEligibleOrderId(userId, productId);
  if (!orderId) {
    throw new ConflictError("Bạn cần mua và hoàn tất thanh toán sản phẩm này trước khi đánh giá");
  }

  // Race cực hiếm: hai tab cùng gửi đánh giá cho cùng một đơn cùng lúc — @@unique chặn ở DB
  const review = await prisma.review
    .create({
      data: {
        productId,
        userId,
        orderId,
        rating: input.rating,
        title: input.title,
        content: input.content,
        isVerified: true, // luôn gắn với một đơn đã thanh toán thật, không có luồng đánh giá "khách vãng lai"
      },
      include: reviewInclude,
    })
    .catch(() => {
      throw new ConflictError("Đơn hàng này đã được dùng để đánh giá sản phẩm rồi");
    });

  return toReviewDto(review);
}

/** `GET /api/products/:slug/reviews` — chỉ đánh giá ĐÃ DUYỆT, mới nhất trước */
export async function listApprovedReviews(
  productSlug: string,
  page: number,
  pageSize: number,
): Promise<Paginated<ReviewDto>> {
  const productId = await resolveActiveProductId(productSlug);
  const where = { productId, isApproved: true } satisfies Prisma.ReviewWhereInput;

  const [rows, total] = await Promise.all([
    prisma.review.findMany({
      where,
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.review.count({ where }),
  ]);

  return {
    items: rows.map(toReviewDto),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

/**
 * Tính lại rating trung bình + số lượng của sản phẩm từ các đánh giá ĐÃ DUYỆT — gọi sau mỗi lần
 * duyệt/xoá một đánh giá (admin-review.service.ts). Chưa duyệt thì không tính vào, đúng nguyên tắc
 * "chỉ hiện số liệu đã kiểm duyệt" của tính năng này.
 */
export async function recomputeProductRating(db: Db, productId: string): Promise<void> {
  const agg = await db.review.aggregate({
    where: { productId, isApproved: true },
    _avg: { rating: true },
    _count: true,
  });
  await db.product.update({
    where: { id: productId },
    data: { ratingAvg: agg._avg.rating ?? 0, ratingCount: agg._count },
  });
}
