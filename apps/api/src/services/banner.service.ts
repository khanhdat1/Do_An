import { prisma } from "@pczone/db";
import { toBannerDto } from "../mappers/banner.mapper.js";
import type { BannerDto } from "../types/dto.js";

/**
 * Banner đang thật sự hiện được ngay bây giờ: PUBLISHED (admin đã bấm đăng, không phải nháp) VÀ
 * đang trong khoảng ngày hiệu lực (để trống startsAt/endsAt = không giới hạn phía đó) — cùng kiểu
 * điều kiện `listActiveVouchers` đã dùng cho trang công khai của mã giảm giá.
 */
export async function listActiveBanners(): Promise<BannerDto[]> {
  const now = new Date();
  const rows = await prisma.banner.findMany({
    where: {
      status: "PUBLISHED",
      OR: [{ startsAt: null }, { startsAt: { lte: now } }],
      AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
    },
    orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
  });

  return rows.map(toBannerDto);
}
