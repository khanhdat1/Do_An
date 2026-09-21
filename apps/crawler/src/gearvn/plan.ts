/**
 * Kế hoạch thu thập dữ liệu demo: mỗi danh mục của PCZone lấy bao nhiêu sản phẩm, từ bộ sưu tập
 * nào của GEARVN. Tổng 122 sản phẩm, cộng 14 sản phẩm mẫu trong seed là 136.
 */
export interface CategoryPlan {
  /** Slug danh mục trong packages/db/prisma/seed.ts */
  category: string;
  /** Số sản phẩm cần lấy */
  want: number;
  /**
   * Tên bộ sưu tập trên GEARVN (https://gearvn.com/collections/<tên>), theo thứ tự đọc.
   * Bộ sưu tập chung đứng trước; các bộ sưu tập hẹp (theo hãng, theo tầm giá) đứng sau để bù
   * khi bộ sưu tập chung có nhiều hàng hết.
   */
  collections: string[];
  /** Số trang tối đa đọc cho mỗi bộ sưu tập (mỗi trang ~20 sản phẩm) */
  pages: number;
  /** Tên sản phẩm phải khớp mẫu này: chặn phụ kiện, hàng khác danh mục lọt vào bộ sưu tập */
  nameMatches: RegExp;
  /** Tên khớp mẫu này thì bỏ (vd RAM laptop trong danh mục RAM máy bàn) */
  nameExcludes?: RegExp;
  /** Khoảng giá (VNĐ) chấp nhận: loại phụ kiện rẻ tiền và hàng "khủng" làm méo thanh trượt giá */
  minPrice: number;
  maxPrice: number;
}

export const CATEGORY_PLAN: CategoryPlan[] = [
  {
    category: "cpu",
    want: 10,
    collections: ["cpu-bo-vi-xu-ly"],
    pages: 2,
    nameMatches: /^(bộ vi xử lý|cpu)/i,
    minPrice: 500_000,
    maxPrice: 20_000_000,
  },
  {
    category: "mainboard",
    want: 8,
    collections: ["mainboard-bo-mach-chu", "mainboard-amd-b650", "mainboard-intel-b760-raptor-lake"],
    pages: 2,
    nameMatches: /^(bo mạch chủ|mainboard|main )/i,
    minPrice: 500_000,
    maxPrice: 12_000_000,
  },
  {
    category: "ram",
    want: 8,
    collections: ["ram-pc", "ram-pc-ddr5", "ram-ddr4"],
    pages: 2,
    nameMatches: /^ram/i,
    nameExcludes: /laptop/i,
    minPrice: 300_000,
    maxPrice: 25_000_000,
  },
  {
    category: "vga",
    want: 12,
    collections: ["vga-rtx-50-series", "vga-card-man-hinh", "radeon-rx"],
    pages: 2,
    nameMatches: /^(card màn hình|vga)/i,
    minPrice: 2_000_000,
    maxPrice: 60_000_000,
  },
  {
    category: "ssd",
    want: 8,
    collections: ["ssd-o-cung-the-ran", "ssd-1tb", "ssd-samsung", "kingston-ssd", "ssd-480-512gb"],
    pages: 2,
    nameMatches: /^(ssd|ổ cứng ssd)/i,
    minPrice: 300_000,
    maxPrice: 20_000_000,
  },
  {
    category: "psu",
    want: 6,
    collections: ["psu-nguon-may-tinh", "nguon-corsair", "700w-800w"],
    pages: 1,
    nameMatches: /^nguồn/i,
    minPrice: 400_000,
    maxPrice: 10_000_000,
  },
  {
    category: "case",
    want: 8,
    collections: ["case-tren-2-trieu", "case-tu-1-trieu-den-2-trieu", "case-corsair", "case-lian-li", "case-nzxt"],
    pages: 1,
    nameMatches: /^(vỏ máy tính|vỏ case|case)/i,
    minPrice: 500_000,
    maxPrice: 8_000_000,
  },
  {
    category: "laptop-gaming",
    want: 12,
    collections: ["laptop-gaming", "laptop-gaming-duoi-30-trieu", "laptop-gaming-tu-30-den-50-trieu"],
    pages: 2,
    nameMatches: /^laptop/i,
    minPrice: 8_000_000,
    maxPrice: 90_000_000,
  },
  {
    category: "laptop-van-phong",
    want: 8,
    collections: [
      "laptop-hoc-tap-va-lam-viec-tu-15tr-den-20tr",
      "laptop-hoc-tap-va-lam-viec-tren-20-trieu",
      "laptop-hoc-tap-va-lam-viec-duoi-15tr",
      "laptop-dell-hoc-tap-va-lam-viec",
      "laptop-lenovo-hoc-tap-va-lam-viec",
    ],
    pages: 1,
    nameMatches: /^laptop/i,
    minPrice: 8_000_000,
    maxPrice: 40_000_000,
  },
  {
    category: "pc-gaming",
    want: 8,
    collections: ["pc-gvn", "pc-gvn-duoi-30-trieu", "pc-gvn-duoi-50-trieu", "pc-gvn-tu-50-70-trieu"],
    pages: 2,
    // Chỉ máy có card đồ họa rời — bỏ máy bộ văn phòng lẫn trong bộ sưu tập PC
    nameMatches: /^pc gvn.*\b(rtx|rx|gtx|arc)\b/i,
    minPrice: 8_000_000,
    maxPrice: 70_000_000,
  },
  {
    // Cấu hình cao cấp (CPU nhiều nhân + RTX 5080/5090) hợp với dựng hình và AI.
    // Từ 70 triệu để không trùng với PC Gaming ở trên.
    category: "pc-workstation",
    want: 4,
    collections: ["pc-gvn-tu-100-200-trieu", "pc-gvn-tu-70-100-trieu", "ai-pc-gvn"],
    pages: 1,
    nameMatches: /^pc gvn/i,
    // "CUSTOM" là trang cấu hình mẫu của nguồn: tên máy và bảng thông số ghi hai CPU khác nhau, ổ cứng "4098 GB"
    nameExcludes: /(xtreme|mini|custom)/i,
    minPrice: 70_000_000,
    maxPrice: 260_000_000,
  },
  {
    category: "man-hinh",
    want: 14,
    collections: ["man-hinh", "man-hinh-oled", "man-hinh-cong"],
    pages: 2,
    nameMatches: /^màn hình/i,
    minPrice: 1_000_000,
    maxPrice: 35_000_000,
  },
  {
    category: "ban-phim",
    want: 8,
    collections: ["ban-phim-co", "ban-phim-logitech", "ban-phim-akko", "ban-phim-asus"],
    pages: 1,
    nameMatches: /^bàn phím/i,
    minPrice: 200_000,
    maxPrice: 12_000_000,
  },
  {
    category: "chuot",
    want: 8,
    collections: ["chuot-may-tinh", "chuot-logitech", "chuot-razer", "chuot-asus"],
    pages: 1,
    nameMatches: /^chuột/i,
    minPrice: 150_000,
    maxPrice: 5_000_000,
  },
];

/**
 * Không lấy combo, hàng cũ, hàng thanh lý dù còn hàng.
 * Dùng lookaround Unicode thay cho `\b` vì `\b` của JS chỉ hiểu chữ ASCII: "thanh lý" kết thúc
 * bằng "ý" nên `\b` sau nó không bao giờ khớp.
 */
export const EXCLUDED_NAME =
  /(?<![\p{L}\p{N}])(combo|thanh lý|second hand|hàng cũ|refurbished|open box|trưng bày|demo)(?![\p{L}\p{N}])/iu;

/** Các mẫu đã có trong seed.ts: bỏ qua để không có hai sản phẩm giống hệt nhau trong cùng danh mục */
export const ALREADY_SEEDED =
  /(9700X|7800X3D|4070 Ti SUPER|4080 SUPER|G614JIR|FA507NV|990 Pro 2TB|Superlight 2|PG32UCDM|Odyssey OLED G8|Legion Pro 7i|Vengeance RGB DDR5 32)/i;
