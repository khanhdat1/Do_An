/**
 * Kiểm thử bộ nhận diện logo GEARVN (watermark.ts) bằng ảnh tổng hợp, không cần mạng.
 * Chạy: npx tsx src/images/watermark.test.ts
 *
 * Ảnh có logo được dựng bằng chính mặt nạ logo (LOGO_MASK_PNG) dán vào góc trên phải một nền tối;
 * các ca "không được nhận nhầm" là ảnh nền trắng, nền xám nhạt và ảnh có huy hiệu tròn trắng ở đúng góc đó
 * (như huy hiệu bảo hành trên ảnh mainboard của hãng).
 */
import sharp from "sharp";
import { LOGO_MASK_PNG, isLogoMatch, rejectRetailerLogo, scanGearvnLogo } from "./watermark.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}\n      mong đợi: ${e}\n      nhận được: ${a}`);
    failed++;
  }
}

/** Mặt nạ logo thành ảnh RGBA trắng trên nền trong suốt, phóng `factor` lần (nearest để giữ nét) */
async function logoLayer(factor: number): Promise<{ input: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(Buffer.from(LOGO_MASK_PNG, "base64")).greyscale().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(info.width * info.height * 4);
  for (let i = 0; i < info.width * info.height; i++) {
    rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = 255;
    rgba[i * 4 + 3] = data[i] > 127 ? 255 : 0;
  }
  const input = await sharp(rgba, { raw: { width: info.width, height: info.height, channels: 4 } })
    .resize({ width: Math.round(info.width * factor), kernel: "nearest" })
    .png()
    .toBuffer();
  return { input, width: Math.round(info.width * factor), height: Math.round(info.height * factor) };
}

/** Ảnh nền đơn sắc `width` x `height`, tuỳ chọn dán logo ở góc trên phải (mặc định) hoặc trên trái */
async function photo(background: string, width: number, logoFactor?: number, corner: "right" | "left" = "right"): Promise<Buffer> {
  const height = Math.round(width * 0.67);
  let image = sharp({ create: { width, height, channels: 3, background } });
  if (logoFactor !== undefined) {
    const logo = await logoLayer(logoFactor);
    const left = corner === "right" ? Math.round(width * 0.85 - logo.width / 2 - 20) : Math.round(width * 0.03);
    image = image.composite([{ input: logo.input, left, top: Math.round(height * 0.05) }]);
  }
  return image.jpeg({ quality: 90 }).toBuffer();
}

console.log("\n[1] Ảnh có logo phải bị nhận ra");
{
  check("logo cỡ mẫu trên nền tối", (await scanGearvnLogo(await photo("#10141c", 800, 1))).found, true);
  check("logo phóng 1,4 lần (ảnh chụp lớn) trên nền màu", (await scanGearvnLogo(await photo("#1d4ed8", 1120, 1.4))).found, true);
  check("logo trên ảnh 2048px (thu nhỏ trước khi so khớp)", (await scanGearvnLogo(await photo("#222a35", 2048, 2.3))).found, true);
  check("rejectRetailerLogo trả lý do", await rejectRetailerLogo(await photo("#10141c", 800, 1)), "có logo GEARVN đóng ở góc ảnh");
  check("logo ở góc trên TRÁI (một số bộ ảnh PC đóng bên trái)", (await scanGearvnLogo(await photo("#10141c", 800, 1, "left"))).found, true);
  check("logo trái, ảnh 2048px, phóng lớn", (await scanGearvnLogo(await photo("#1d4ed8", 2048, 2.6, "left"))).found, true);
}

console.log("\n[1b] Luật ngưỡng");
{
  check("khớp rõ trên nền tối", isLogoMatch(0.97, 1), true);
  check("logo hơi mờ nhưng vẫn đủ (bộ ảnh PC đóng ở góc trên trái)", isLogoMatch(0.56, 0.51), true);
  // Đã thử nới precision xuống 0,4 để bắt logo trên nền sáng, nhưng huy hiệu TUF, hộp Zotac, nguồn MSI cũng chạm ngưỡng
  // đó và ảnh chính của vài sản phẩm bị loại oan; logo nền sáng đi theo data/image-blocklist.json thay vì nới ngưỡng.
  check("ảnh sạch sát ngưỡng đã thử nới (precision 0,40–0,41) không bị loại", [isLogoMatch(0.63, 0.41), isLogoMatch(0.61, 0.4), isLogoMatch(0.78, 0.4), isLogoMatch(0.76, 0.4)], [false, false, false, false]);
  check("nền trắng, xám nhạt, hộp sản phẩm sáng: precision thấp", [isLogoMatch(0.95, 0.24), isLogoMatch(0.9, 0.35), isLogoMatch(0.96, 0.31), isLogoMatch(0.64, 0.38), isLogoMatch(0.68, 0.36)], [false, false, false, false, false]);
  check("recall thấp dù precision cao (huy hiệu khác hình)", [isLogoMatch(0.42, 0.49), isLogoMatch(0.45, 0.49), isLogoMatch(0.5, 0.9)], [false, false, false]);
}

console.log("\n[2] Ảnh sạch không được nhận nhầm");
{
  check("nền tối không logo", (await scanGearvnLogo(await photo("#10141c", 800))).found, false);
  check("nền trắng (ảnh render sản phẩm)", (await scanGearvnLogo(await photo("#ffffff", 800))).found, false);
  check("nền xám nhạt", (await scanGearvnLogo(await photo("#f0f0f0", 1200))).found, false);
  check("rejectRetailerLogo với ảnh sạch → null", await rejectRetailerLogo(await photo("#10141c", 800)), null);

  // Huy hiệu tròn (viền + chấm giữa + vạch chữ) ở góc trên phải, cỡ tương đương logo, nhưng không phải logo.
  // Cố ý là hình rỗng: một khối trắng đặc phủ kín khung logo thì luật nền-sáng có thể nhận nhầm, và bỏ nhầm một
  // ảnh gallery là cái giá chấp nhận được để không lọt logo thật.
  const badge = await sharp({ create: { width: 800, height: 536, channels: 3, background: "#101010" } })
    .composite([
      {
        input: Buffer.from('<svg width="90" height="60" xmlns="http://www.w3.org/2000/svg"><circle cx="30" cy="30" r="26" fill="none" stroke="white" stroke-width="5"/><circle cx="30" cy="30" r="8" fill="white"/><rect x="62" y="26" width="26" height="6" fill="white"/></svg>'),
        left: 675,
        top: 20,
      },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
  check("huy hiệu trắng khác hình ở đúng góc đó", (await scanGearvnLogo(badge)).found, false);
}

console.log("\n[3] Ảnh quá nhỏ không làm chết bộ quét");
{
  const tiny = await sharp({ create: { width: 60, height: 40, channels: 3, background: "#000" } }).png().toBuffer();
  check("ảnh 60x40 → không lỗi, không nhận diện", (await scanGearvnLogo(tiny)).found, false);
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
