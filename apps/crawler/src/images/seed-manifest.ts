/**
 * Danh sách ảnh THẬT cho các sản phẩm mẫu trong packages/db/prisma/seed.ts.
 *
 * Chỉ dùng ảnh chụp / ảnh studio thật, KHÔNG dùng ảnh do AI sinh ra:
 *   - Sản phẩm của hãng (ASUS, AMD, Samsung, Corsair, Logitech, Gigabyte, Lenovo):
 *     lấy từ CDN của chính trang sản phẩm hãng — ảnh studio nền trắng, nhiều góc.
 *   - PC lắp ráp của PCZone (không có hãng nào chụp cho nó): ảnh chụp thật miễn phí
 *     bản quyền trên Unsplash (giấy phép Unsplash: dùng tự do, không cần xin phép).
 *
 * Mỗi bộ ảnh được chọn tay sau khi xem thử: bỏ ảnh banner, ảnh có chữ quảng cáo,
 * ảnh phụ kiện / sản phẩm khác, chỉ giữ ảnh đúng sản phẩm. Ảnh đầu tiên là ảnh đại
 * diện (hiện ở thẻ sản phẩm), các ảnh sau hiện ở thư viện ảnh trang chi tiết.
 *
 * Chạy: npm run seed-images  (tải về, chuyển WebP, ghi bảng ProductImage). Xem attach.ts.
 *
 * Bản quyền ảnh thuộc về các hãng; dự án dùng cho mục đích học tập / demo. Muốn bán
 * thật thì phải thay bằng ảnh có giấy phép của nhà phân phối.
 */

/** Một ảnh: chuỗi URL, hoặc kèm trang gốc khi ảnh không cùng trang với cả bộ (ảnh stock) */
export type SeedImage = string | { url: string; page: string };

export interface SeedImageSet {
  /** Slug sản phẩm trong seed.ts */
  slug: string;
  /** Ghi vào ProductImage.source: tên hãng hoặc nguồn ảnh, viết hoa */
  source: string;
  /** Trang sản phẩm chính hãng (hoặc trang nguồn) — ghi vào ProductImage.sourceUrl để truy vết */
  sourceUrl: string;
  images: SeedImage[];
}

export const SEED_IMAGES: SeedImageSet[] = [
  // ram-corsair-vengeance-rgb-ddr5-32gb
  {
    slug: "ram-corsair-vengeance-rgb-ddr5-32gb",
    source: "CORSAIR",
    sourceUrl: "https://www.corsair.com/us/en/p/memory/cmh32gx5m2d6000c36/vengeance-rgb-32gb-2x16gb-ddr5-dram-6000mhz-c36-memory-kit-black-cmh32gx5m2d6000c36",
    images: [
      "https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Memory/vengeance-rgb-ddr5-blk-config/Gallery/Vengeance-RGB-DDR5-2UP-BLACK_01.webp",
      "https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Memory/vengeance-rgb-ddr5-blk-config/Gallery/Vengeance-RGB-DDR5-2UP-BLACK_07.webp",
      "https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Memory/vengeance-rgb-ddr5-blk-config/Gallery/Vengeance-RGB-DDR5-2UP-BLACK_10.webp",
      "https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Memory/vengeance-rgb-ddr5-blk-config/Gallery/Vengeance-RGB-DDR5-2UP-BLACK_11.webp",
      "https://assets.corsair.com/image/upload/c_pad,q_auto,h_1024,w_1024,f_auto/products/Memory/vengeance-rgb-ddr5-blk-config/Gallery/Vengeance-RGB-DDR5-2UP-BLACK_13.webp",
    ],
  },

  // ssd-samsung-990-pro-2tb
  {
    slug: "ssd-samsung-990-pro-2tb",
    source: "SAMSUNG",
    sourceUrl: "https://www.samsung.com/us/memory-storage/nvme-ssd/990-pro-pcie-4-0-nvme-ssd-1tb-sku-mz-v9p2t0b-am/",
    images: [
      "https://images.samsung.com/is/image/samsung/p6pim/us/mz-v9p2t0b-am/gallery/us-990pro-nvme-m2-ssd-mz-v9p2t0b-am-551141318?$product-details-jpg$",
      "https://images.samsung.com/is/image/samsung/p6pim/us/mz-v9p2t0b-am/gallery/us-990pro-nvme-m2-ssd-mz-v9p2t0b-am-551141320?$product-details-jpg$",
      "https://images.samsung.com/is/image/samsung/p6pim/us/mz-v9p2t0b-am/gallery/us-nvme-ssd-mz-v9p2t0b-am-----pro---tb-ssd-nvme--m---black-551141174?$product-details-jpg$",
    ],
  },

  // cpu-amd-ryzen-7-7800x3d-box
  {
    slug: "cpu-amd-ryzen-7-7800x3d-box",
    source: "AMD",
    sourceUrl: "https://www.amd.com/en/products/processors/desktops/ryzen/7000-series/amd-ryzen-7-7800x3d.html",
    images: [
      "https://www.amd.com/content/dam/amd/en/images/products/processors/ryzen/2505503-ryzen-7-7800x3d.jpg",
      "https://www.amd.com/content/dam/amd/en/images/products/processors/ryzen/2505503-ryzen-7-7800x3d-front.jpg",
      "https://www.amd.com/content/dam/amd/en/images/products/processors/ryzen/2505503-ryzen-7-7800x3d-pl.jpg",
    ],
  },

  // cpu-amd-ryzen-7-9700x
  {
    slug: "cpu-amd-ryzen-7-9700x",
    source: "AMD",
    sourceUrl: "https://www.amd.com/en/products/processors/desktops/ryzen/9000-series/amd-ryzen-7-9700x.html",
    images: [
      "https://www.amd.com/content/dam/amd/en/images/products/processors/ryzen/2613900-ryzen-7-9700x.jpg",
    ],
  },

  // card-man-hinh-asus-tuf-rtx-4070-ti-super
  {
    slug: "card-man-hinh-asus-tuf-rtx-4070-ti-super",
    source: "ASUS",
    sourceUrl: "https://www.asus.com/us/motherboards-components/graphics-cards/tuf-gaming/tuf-rtx4070tis-o16g-gaming/",
    images: [
      "https://dlcdnwebimgs.asus.com/gain/f1575a0e-bf40-4c10-a864-bd1cfe6a07d0",
      "https://dlcdnwebimgs.asus.com/gain/97792327-96eb-4673-990e-22e951b98e63",
      "https://dlcdnwebimgs.asus.com/gain/478183a7-cbbd-43d0-98df-ed817f1313bc",
      "https://dlcdnwebimgs.asus.com/gain/143609f5-e873-40ec-bed4-5ae5f8b1679c",
      "https://dlcdnwebimgs.asus.com/gain/2123985c-c898-48cb-83f6-c849fd549862",
    ],
  },

  // gigabyte-rtx-4080-super-gaming-oc-16gb
  {
    slug: "gigabyte-rtx-4080-super-gaming-oc-16gb",
    source: "GIGABYTE",
    sourceUrl: "https://www.gigabyte.com/Graphics-Card/GV-N408SGAMING-OC-16GD",
    images: [
      "https://static.gigabyte.com/StaticFile/Image/Global/9bc3f04aa15cc496eba10a787b19014f/ProductRemoveBg/39055",
      "https://static.gigabyte.com/StaticFile/Image/Global/748f429d2100d111113b4a35eed953cd/ProductRemoveBg/39052",
      "https://static.gigabyte.com/StaticFile/Image/Global/70c2974c66d2b9d85aa0287b6e0b5789/ProductRemoveBg/39056",
      "https://static.gigabyte.com/StaticFile/Image/Global/1bb608fc860c13fff81f27ec25059845/ProductRemoveBg/39057",
      "https://static.gigabyte.com/StaticFile/Image/Global/8e43cc6f38346d152fab29e3981cd773/ProductRemoveBg/39058",
    ],
  },

  // man-hinh-samsung-odyssey-oled-g8
  {
    slug: "man-hinh-samsung-odyssey-oled-g8",
    source: "SAMSUNG",
    sourceUrl: "https://www.samsung.com/us/monitors/gaming/34-inch-odyssey-oled-g8-g85sd-ultra-wqhd-175hz-0-03ms-curved-gaming-monitor-sku-ls34dg850snxza/",
    images: [
      "https://images.samsung.com/is/image/samsung/p6pim/us/ls34dg850snxza/gallery/us-odyssey-oled-g8-g85sd-ls34dg850snxza-551981598?$product-details-jpg$",
      "https://images.samsung.com/is/image/samsung/p6pim/us/ls34dg850snxza/gallery/us-odyssey-oled-g8-g85sd-ls34dg850snxza-551981572?$product-details-jpg$",
      "https://images.samsung.com/is/image/samsung/p6pim/us/ls34dg850snxza/gallery/us-odyssey-oled-g8-g85sd-ls34dg850snxza-551981583?$product-details-jpg$",
      "https://images.samsung.com/is/image/samsung/p6pim/us/ls34dg850snxza/gallery/us-odyssey-oled-g8-g85sd-ls34dg850snxza-551981574?$product-details-jpg$",
    ],
  },

  // asus-rog-swift-oled-pg32ucdm
  {
    slug: "asus-rog-swift-oled-pg32ucdm",
    source: "ASUS",
    sourceUrl: "https://rog.asus.com/us/monitors/27-to-31-5-inches/rog-swift-oled-pg32ucdm/",
    images: [
      "https://dlcdnwebimgs.asus.com/gain/5A4B62A0-F7B0-4417-B777-CBFD76A44889",
      "https://dlcdnwebimgs.asus.com/gain/2802183A-8652-4EE9-99FB-F590F461D566",
      "https://dlcdnwebimgs.asus.com/gain/1838F10E-2750-4042-87BF-209B3C3EB3EB",
    ],
  },

  // laptop-asus-rog-strix-g16-g614jir
  {
    slug: "laptop-asus-rog-strix-g16-g614jir",
    source: "ASUS",
    sourceUrl: "https://rog.asus.com/us/laptops/rog-strix/rog-strix-g16-2024/",
    images: [
      "https://dlcdnwebimgs.asus.com/gain/CFE9CB59-216D-4AC9-AEAE-10054506055C",
      "https://dlcdnwebimgs.asus.com/gain/E1907459-5DC4-4C64-BF3B-06E5CE1FB406",
      "https://dlcdnwebimgs.asus.com/gain/5CA99398-7772-4CA9-8857-D19D4B0E5DD5",
      "https://dlcdnwebimgs.asus.com/gain/1C252331-C386-4050-A1CD-116D442F13AA",
      "https://dlcdnwebimgs.asus.com/gain/6DA9638F-6FE9-465E-B553-DF0BBCF84B03",
    ],
  },

  // laptop-asus-tuf-gaming-a15-fa507nv
  {
    slug: "laptop-asus-tuf-gaming-a15-fa507nv",
    source: "ASUS",
    sourceUrl: "https://www.asus.com/us/laptops/for-gaming/tuf-gaming/asus-tuf-gaming-a15-2023/",
    images: [
      "https://dlcdnwebimgs.asus.com/gain/fa623cdb-32a1-4550-8044-245343b1ca08",
      "https://dlcdnwebimgs.asus.com/gain/01668daf-8289-45c5-98a4-b3666c7fff72",
      "https://dlcdnwebimgs.asus.com/gain/9ff22768-fd40-43de-b3d9-14a45d1af8fc",
      "https://dlcdnwebimgs.asus.com/gain/d7eb0b2e-1523-4c01-ab0f-ebb9a7e57f0c",
      "https://dlcdnwebimgs.asus.com/gain/d47d53e6-de20-46bd-8ec0-1a9cc8faf6a0",
    ],
  },

  // laptop-lenovo-legion-pro-7i-gen-9
  {
    slug: "laptop-lenovo-legion-pro-7i-gen-9",
    source: "LENOVO",
    sourceUrl: "https://www.lenovo.com/us/en/p/laptops/legion-laptops/legion-pro-series/legion-pro-7i-gen-9-16-inch-intel/len101g0034",
    images: [
      "https://p1-ofp.static.pub//fes/cms/2024/09/12/q6fb2891avf5ok5et6ppuhuuilu0cq939626.png",
      "https://p2-ofp.static.pub//fes/cms/2024/09/12/hdtezbo787yrezwa710a384b6d6v6x258771.png",
      "https://p2-ofp.static.pub//fes/cms/2024/09/12/58n3zfqc84m20rrhx44xti16yijf8l761454.png",
      "https://p3-ofp.static.pub//fes/cms/2024/09/12/r6qh9u1b9k43p8o18p690abqdszk94820322.png",
      "https://p3-ofp.static.pub//fes/cms/2024/09/12/prjfq0usr0en764rphpnok7nhcd9an357385.png",
    ],
  },

  // logitech-g-pro-x-superlight-2
  {
    slug: "logitech-g-pro-x-superlight-2",
    source: "LOGITECH",
    sourceUrl: "https://www.logitechg.com/en-us/shop/p/pro-x2-superlight-wireless-mouse",
    images: [
      "https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-x-superlight-2/new-gallery-assets-2025/pro-x-superlight-2-mice-top-angle-black-gallery-1.png",
      "https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-x-superlight-2/new-gallery-assets-2025/pro-x-superlight-2-mice-profile-right-angle-black-gallery-5.png",
      "https://resource.logitechg.com/c_fill,q_auto,f_auto,dpr_1.0/d_transparent.gif/content/dam/gaming/en/products/pro-x-superlight-2/new-gallery-assets-2025/pro-x-superlight-2-mice-bottom-angle-black-gallery-6.png",
    ],
  },

  // ---- PC lắp ráp của PCZone: ảnh chụp thật trên Unsplash -----------------------------
  // pc-gaming-pczone-ultra-master-g7 (Ryzen 7 7800X3D + RTX 4080 Super + AIO 360 ARGB)
  {
    slug: "pc-gaming-pczone-ultra-master-g7",
    source: "UNSPLASH",
    sourceUrl: "https://unsplash.com/s/photos/gaming-pc",
    images: [
      {
        url: "https://images.unsplash.com/photo-1756576630180-653cbd594433?w=1600&q=85&fm=jpg",
        page: "https://unsplash.com/photos/custom-gaming-computer-with-rgb-lighting-QLQSgxQzzqg",
      },
      {
        url: "https://images.unsplash.com/photo-1738245494097-9b1e3971c3eb?w=1600&q=85&fm=jpg",
        page: "https://unsplash.com/photos/a-computer-case-sitting-on-top-of-a-desk-VBVtNgkA3ak",
      },
      {
        url: "https://images.unsplash.com/photo-1761131745229-763bffe31248?w=1600&q=85&fm=jpg",
        page: "https://unsplash.com/photos/computer-case-with-rgb-lighting-and-small-display-qFBsjeGyUU0",
      },
    ],
  },

  // pc-gaming-pczone-dragon-knight (i7-14700K + RTX 4070 Ti Super + AIO 360 ARGB)
  {
    slug: "pc-gaming-pczone-dragon-knight",
    source: "UNSPLASH",
    sourceUrl: "https://unsplash.com/s/photos/gaming-pc",
    images: [
      {
        url: "https://images.unsplash.com/photo-1658673609646-9c7ba9514b89?w=1600&q=85&fm=jpg",
        page: "https://unsplash.com/photos/a-computer-tower-with-a-fan-kNsTXSGXgtE",
      },
      {
        url: "https://images.unsplash.com/photo-1587202372775-e229f172b9d7?w=1600&q=85&fm=jpg",
        page: "https://unsplash.com/photos/white-and-black-round-light-KV2vFOYItcY",
      },
      {
        url: "https://images.unsplash.com/photo-1660855551740-4474188debdb?w=1600&q=85&fm=jpg",
        page: "https://unsplash.com/photos/a-computer-with-a-blue-light-5WJhuXkqCkc",
      },
    ],
  },
];
