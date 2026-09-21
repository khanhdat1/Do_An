/**
 * Kế hoạch thu thập dữ liệu demo: mỗi danh mục của PCZone lấy bao nhiêu sản phẩm, từ bộ sưu tập
 * nào của GEARVN. Tổng 422 sản phẩm, cộng 14 sản phẩm mẫu trong seed là 436.
 */
export interface CategoryPlan {
  /** Slug danh mục trong packages/db/prisma/seed.ts */
  category: string;
  /**
   * TỔNG số sản phẩm nhập cho danh mục (không tính các mẫu trong seed.ts). Nâng số này rồi chạy lại
   * `collect-demo` thì chỉ lấy thêm phần còn thiếu, không thu thập lại các sản phẩm đã có.
   */
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
  /**
   * Số thuộc tính tối thiểu của bảng thông số ở trang sản phẩm (mặc định 4). Trang thiếu bảng thì mô
   * tả nghèo nàn nên nhường chỗ cho ứng viên kế; danh mục có ít hàng (bàn) hạ mức này xuống.
   */
  minAttributes?: number;
  /**
   * Trang sản phẩm không có bảng thông số thì đọc thông số từ tên (xem title-specs.ts). Laptop GEARVN
   * ghi CPU / card đồ họa / RAM / SSD / màn hình ngay trong tên nên vẫn dựng được mô tả đầy đủ.
   */
  titleSpecs?: "laptop";
}

/** Tên laptop gaming: loại khỏi nhóm laptop văn phòng dù nằm trong bộ sưu tập học tập – làm việc */
const GAMING_LAPTOP_NAME =
  /(gaming|rog\b|tuf\b|legion|loq\b|nitro|predator|katana|cyborg|sword|vector|raider|stealth|titan|thin\s?(15|gf)|helios|omen|victus|alienware|zephyrus)/i;

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
    want: 14,
    collections: [
      "mainboard-bo-mach-chu",
      "mainboard-amd-b650",
      "mainboard-intel-b760-raptor-lake",
      "mainboard-amd-x870",
      "mainboard-intel-z890",
      "mainboard-intel-z790-raptor-lake",
    ],
    pages: 2,
    nameMatches: /^(bo mạch chủ|mainboard|main )/i,
    minPrice: 500_000,
    maxPrice: 12_000_000,
  },
  {
    category: "ram",
    want: 14,
    collections: ["ram-pc", "ram-pc-ddr5", "ram-ddr4", "ram-ddr5-64gb"],
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
    want: 13,
    collections: ["ssd-o-cung-the-ran", "ssd-1tb", "ssd-samsung", "kingston-ssd", "ssd-480-512gb", "ssd-sandisk"],
    pages: 2,
    nameMatches: /^(ssd|ổ cứng ssd)/i,
    minPrice: 300_000,
    maxPrice: 20_000_000,
  },
  {
    category: "psu",
    want: 12,
    collections: ["psu-nguon-may-tinh", "nguon-corsair", "700w-800w", "nguon-may-tinh-asus", "nguon-may-tinh-nzxt"],
    pages: 2,
    nameMatches: /^nguồn/i,
    minPrice: 400_000,
    maxPrice: 10_000_000,
  },
  {
    category: "case",
    want: 13,
    collections: [
      "case-tren-2-trieu",
      "case-tu-1-trieu-den-2-trieu",
      "case-corsair",
      "case-lian-li",
      "case-nzxt",
      "case-thung-may-tinh",
      "case-asus",
      "case-duoi-1-trieu",
    ],
    pages: 2,
    nameMatches: /^(vỏ máy tính|vỏ case|case)/i,
    minPrice: 500_000,
    maxPrice: 8_000_000,
  },
  {
    category: "laptop-gaming",
    want: 67,
    collections: [
      "laptop-gaming",
      "laptop-gaming-duoi-30-trieu",
      "laptop-gaming-tu-30-den-50-trieu",
      "laptop-gaming-tren-50-trieu",
      "laptop-gaming-acer",
      "laptop-gaming-asus",
      "laptop-msi-gaming",
      "laptop-gaming-lenovo",
      "laptop-gaming-gigabyte",
      "laptop-acer-nitro-series",
      "laptop-acer-predator-series",
      "laptop-asus-tuf-gaming-series",
      "laptop-asus-rog-series",
      "laptop-lenovo-legion",
      "laptop-gaming-lenovo-loq",
      "laptop-msi-gf-series",
    ],
    pages: 6,
    nameMatches: /^laptop/i,
    minPrice: 8_000_000,
    maxPrice: 100_000_000,
    titleSpecs: "laptop",
  },
  {
    category: "laptop-van-phong",
    want: 80,
    collections: [
      "laptop-hoc-tap-va-lam-viec-tu-15tr-den-20tr",
      "laptop-hoc-tap-va-lam-viec-tren-20-trieu",
      "laptop-hoc-tap-va-lam-viec-duoi-15tr",
      "laptop-van-phong-ban-chay",
      "laptop-acer-hoc-tap-va-lam-viec",
      "laptop-asus-hoc-tap-va-lam-viec",
      "laptop-dell-hoc-tap-va-lam-viec",
      "laptop-lenovo-hoc-tap-va-lam-viec",
      "laptop-msi-hoc-tap-va-lam-viec",
      "laptop-asus-vivobook-series",
      "laptop-asus-zenbook-series",
      "laptop-acer-aspire-series",
    ],
    pages: 6,
    nameMatches: /^laptop/i,
    nameExcludes: GAMING_LAPTOP_NAME,
    minPrice: 8_000_000,
    maxPrice: 60_000_000,
    titleSpecs: "laptop",
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
    want: 26,
    collections: [
      "man-hinh",
      "man-hinh-oled",
      "man-hinh-cong",
      "man-hinh-asus",
      "man-hinh-dell",
      "man-hinh-viewsonic",
      "man-hinh-aoc",
      "man-hinh-acer",
      "man-hinh-msi",
      "man-hinh-samsung",
      "man-hinh-gigabyte",
      "man-hinh-do-hoa",
      "man-hinh-240hz",
      "man-hinh-may-tinh-4k-uhd",
    ],
    pages: 2,
    nameMatches: /^màn hình/i,
    minPrice: 1_000_000,
    maxPrice: 35_000_000,
  },
  {
    category: "ban-phim",
    want: 32,
    collections: [
      "ban-phim-co",
      "ban-phim-may-tinh",
      "ban-phim-logitech",
      "ban-phim-akko",
      "ban-phim-asus",
      "ban-phim-aula",
      "ban-phim-keychron",
      "ban-phim-e-dra",
      "ban-phim-choi-game-corsair",
      "ban-phim-choi-game-razer",
      "ban-phim-steelseries",
      "ban-phim-rapoo",
      "ban-phim-machenike",
      "ban-phim-leopold",
      "ban-phim-dare-u",
      "ban-phim-rapid-trigger",
    ],
    pages: 2,
    nameMatches: /^bàn phím/i,
    minPrice: 200_000,
    maxPrice: 12_000_000,
    // Nhiều trang bàn phím chỉ ghi màu, kiểu dáng, kết nối: bảng đó không đủ dựng bài mô tả dài
    minAttributes: 8,
  },
  {
    category: "chuot",
    want: 30,
    collections: [
      "chuot-may-tinh",
      "chuot-logitech",
      "chuot-razer",
      "chuot-asus",
      "chuot-corsair",
      "chuot-steelseries",
      "chuot-hyperx",
      "chuot-dare-u",
      "chuot-rapoo",
      "chuot-atk",
      "chuot-akko",
      "chuot-logitech-gaming",
      "chuot-500-nghin-den-1-trieu",
      "chuot-1-den-2-trieu",
      "chuot-2-den-3-trieu",
      "chuot-tren-3-trieu",
    ],
    pages: 2,
    nameMatches: /^chuột/i,
    minPrice: 150_000,
    maxPrice: 5_000_000,
    minAttributes: 8,
  },
  {
    category: "tai-nghe",
    want: 32,
    collections: [
      "tai-nghe-may-tinh",
      "tai-nghe-logitech",
      "tai-nghe-razer",
      "tai-nghe-hyperx",
      "tai-nghe-asus",
      "tai-nghe-corsair",
      "tai-nghe-edifier",
      "tai-nghe-rapoo",
      "tai-nghe-onikuma",
      "tai-nghe-akko",
      "tai-nghe-wireless",
      "tai-nghe-over-ear",
      "tai-nghe-gaming-bluetooth",
      "tai-nghe-tren-4-trieu",
    ],
    pages: 2,
    nameMatches: /^tai nghe/i,
    nameExcludes: /(phụ kiện|hộp đựng|đệm tai|bọc tai|giá treo|jack chuyển|đầu chuyển)/i,
    minPrice: 200_000,
    maxPrice: 12_000_000,
  },
  {
    category: "loa",
    want: 16,
    collections: ["loa", "loa-edifier"],
    pages: 2,
    nameMatches: /^loa/i,
    nameExcludes: /(phụ kiện|chân loa|giá đỡ)/i,
    minPrice: 250_000,
    maxPrice: 20_000_000,
  },
  {
    category: "ghe",
    want: 32,
    collections: [
      "ghe-gaming",
      "ghe-gia-tot",
      "ghe-cong-thai-hoc",
      "ghe-corsair",
      "ghe-warrior",
      "ghe-e-dra",
      "ghe-gaming-razer",
      "ghe-sihoo",
      "ghe-cong-thai-hoc-hyperwork",
      "ghe-cong-thai-hoc-warrior",
      "ghe-cong-thai-hoc-e-dra",
      "ghe-duoi-5-trieu",
      "ghe-gaming-tu-5-10-trieu",
      "ghe-tren-10-trieu",
    ],
    pages: 2,
    nameMatches: /^ghế/i,
    nameExcludes: /(phụ kiện|bánh xe)/i,
    minPrice: 1_000_000,
    maxPrice: 20_000_000,
  },
  {
    category: "ban",
    // Nguồn chỉ có khoảng chục mẫu bàn, trong đó có 7 trang có bảng thông số (bàn nâng hạ Warrior, Cooler Master)
    want: 7,
    collections: ["ban-gaming", "ban-warrior", "ban-cong-thai-hoc", "ban-cth-warrior", "ban-dxracer", "ban-gaming-e-dra"],
    pages: 1,
    // "Bàn phím" và "Bàn di chuột" cũng bắt đầu bằng "Bàn" nhưng thuộc danh mục khác
    nameMatches: /^bàn(?! (phím|di))/i,
    nameExcludes: /(phụ kiện|chân bàn)/i,
    minPrice: 1_000_000,
    maxPrice: 30_000_000,
    // Trang bàn của nguồn thường chỉ ghi vài dòng (kiểu dáng, màu, tính năng)
    minAttributes: 2,
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
  /(9700X|7800X3D|4070 Ti SUPER|4080 SUPER|G614JIR|FA507NV|990 Pro 2TB|Superlight 2|PG32UCDM|Odyssey OLED G8|Legion Pro 7i|Legion Pro 7 16IAX10H|Vengeance RGB DDR5 32)/i;
