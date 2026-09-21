/**
 * Phát hiện logo GEARVN đóng trên ảnh sản phẩm.
 *
 * Ảnh do chính GEARVN chụp (đặc biệt bộ PC lắp ráp) có logo "GEARVN.COM" màu trắng ở góc trên
 * bên phải; một số bộ ảnh đóng ở góc khác (trên trái, dưới trái). Ảnh dính logo của shop khác không được dùng cho
 * PCZone, và cũng không xoá/cắt logo đi (đó là sửa ảnh của người khác để giấu nguồn), nên cách đúng
 * là bỏ hẳn tấm đó.
 *
 * Vì sao không chỉ đếm điểm ảnh trắng ở góc: nhiều ảnh linh kiện sạch có huy hiệu trắng/vàng của
 * chính hãng đúng góc đó (vd "5 năm bảo hành TUF Gaming" của ASUS) và nền sáng cũng toàn điểm
 * trắng. Nên đối chiếu với HÌNH DẠNG logo (so khớp mẫu) chứ không chỉ màu:
 *
 *   recall    = phần logo mẫu được phủ bởi điểm trắng của ảnh   (cao: chữ logo có mặt đủ)
 *   precision = phần điểm trắng trong khung logo thuộc về logo  (cao: chỗ đó không phải nền trắng)
 *
 * Nền trắng, nền xám nhạt hay huy hiệu khác hình đều rớt ít nhất một trong hai chỉ số.
 * Logo nằm trên nền sáng gần trắng thì không tách được và có thể bị bỏ sót; ảnh nghi ngờ vẫn phải
 * xem mắt một lượt trước khi đưa vào demo (xem README, mục "Ảnh sản phẩm").
 */
import sharp from "sharp";

/** Mặt nạ logo (1 = điểm trắng), rộng ~92px khi ảnh được thu về 800px; PNG 2 màu mã hoá base64 */
export const LOGO_MASK_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAFwAAAAUAQMAAAA6KsgaAAAABlBMVEUAAAD///+l2Z/dAAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAs0lEQVQY03WOOwrCQBiEJ65sVvwxP1ZbRbyBYpPKB15krWw9QCCPykLUI0UsvEasLLVMIa5RUYPgwMB8zBQDa22GtyJr4yqIPNo4xThmjKyVgRHOerZkDAFiIxLZJYYPaBiZ1AYtRkdcdXir72S7yfDcJ0xX7cYWbpJrMjQvfHUpISMy3lGTWkDs45Y2ukukehCH2L1E276EYjgn4PPHOeOfwl9IH4FLB4BKefJqguqMv/EOrhAu/VZL3AwAAAAASUVORK5CYII=";

/**
 * Ngưỡng chấp nhận: recall >= 0,55 và precision >= 0,5.
 *
 * Đã thử nới (precision >= 0,4) để bắt cả logo nằm trên nền sáng một phần, nhưng lúc đó huy hiệu bảo hành
 * TUF Gaming trên ảnh mainboard, hộp sản phẩm sáng của card Zotac, nguồn MSI... cũng chạm ngưỡng (recall
 * 0,6–0,65 / precision 0,40–0,41) và ảnh chính của vài sản phẩm bị loại oan. Logo trên nền sáng là số ít, đã
 * xem mắt và ghi vào data/image-blocklist.json; ưu tiên ít loại nhầm hơn.
 */
export function isLogoMatch(recall: number, precision: number): boolean {
  return recall >= MIN_RECALL && precision >= MIN_PRECISION;
}

const MIN_RECALL = 0.55;
const MIN_PRECISION = 0.5;

/**
 * Logo chiếm 10–17% chiều rộng ảnh tuỳ ảnh. Thay vì phóng mẫu lên (vỡ hạt), thu ảnh về vài cỡ
 * khác nhau sao cho logo luôn rộng ~92px như mẫu: 92/900 = 10%, 92/540 = 17%.
 */
const SCAN_WIDTHS = [900, 800, 700, 600, 540];

/**
 * Vùng soi: cả bốn góc ảnh (mỗi góc rộng 32% chiều ngang, cao 22%). GEARVN đóng logo ở góc trên phải trên đa số
 * ảnh, nhưng mỗi bộ ảnh một kiểu: có bộ đóng góc trên trái, có bộ đóng góc dưới trái.
 */
const ROI_X = 0.32;
const ROI_HEIGHT = 0.22;

/** Điểm ảnh có thể là chữ logo: sáng và gần trung tính (JPEG làm ngả màu chút ít nên để dung sai) */
const isBright = (r: number, g: number, b: number) => Math.min(r, g, b) >= 200 && Math.max(r, g, b) - Math.min(r, g, b) <= 60;

interface Template {
  width: number;
  height: number;
  /** Toạ độ (x, y) các điểm trắng của mẫu, xếp phẳng: [x0, y0, x1, y1, ...] */
  points: Int32Array;
}

let templatePromise: Promise<Template> | undefined;

function loadTemplate(): Promise<Template> {
  templatePromise ??= (async () => {
    const { data, info } = await sharp(Buffer.from(LOGO_MASK_PNG, "base64"))
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const points: number[] = [];
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        if (data[y * info.width + x] > 127) points.push(x, y);
      }
    }
    return { width: info.width, height: info.height, points: Int32Array.from(points) };
  })();
  return templatePromise;
}

export interface LogoMatch {
  found: boolean;
  recall: number;
  precision: number;
}

interface RawImage {
  data: Buffer;
  width: number;
  channels: number;
}

/** Tìm vị trí khớp mẫu tốt nhất trong một vùng chữ nhật (từ cột `left`, hàng `top`, rộng `roiWidth`, cao `roiHeight`) */
function searchRegion(image: RawImage, template: Template, left: number, top: number, roiWidth: number, roiHeight: number): LogoMatch {
  const total = template.points.length / 2;
  let best: LogoMatch = { found: false, recall: 0, precision: 0 };
  if (roiWidth < template.width || roiHeight < template.height) return best;

  // Mặt nạ vùng soi + ảnh tích phân để đếm nhanh điểm trắng trong một khung bất kỳ
  const mask = new Uint8Array(roiWidth * roiHeight);
  const integral = new Int32Array((roiWidth + 1) * (roiHeight + 1));
  for (let y = 0; y < roiHeight; y++) {
    let rowSum = 0;
    for (let x = 0; x < roiWidth; x++) {
      const i = ((top + y) * image.width + left + x) * image.channels;
      const on = isBright(image.data[i], image.data[i + 1], image.data[i + 2]) ? 1 : 0;
      mask[y * roiWidth + x] = on;
      rowSum += on;
      integral[(y + 1) * (roiWidth + 1) + x + 1] = integral[y * (roiWidth + 1) + x + 1] + rowSum;
    }
  }
  const boxSum = (x: number, y: number) => {
    const stride = roiWidth + 1;
    const x2 = x + template.width;
    const y2 = y + template.height;
    return integral[y2 * stride + x2] - integral[y * stride + x2] - integral[y2 * stride + x] + integral[y * stride + x];
  };

  for (let y = 0; y <= roiHeight - template.height; y++) {
    for (let x = 0; x <= roiWidth - template.width; x++) {
      const inBox = boxSum(x, y);
      if (inBox < total * MIN_RECALL) continue;

      let hits = 0;
      for (let p = 0; p < template.points.length; p += 2) {
        hits += mask[(y + template.points[p + 1]) * roiWidth + x + template.points[p]];
      }

      const recall = hits / total;
      const precision = hits / inBox;
      const found = isLogoMatch(recall, precision);
      const better = recall * precision > best.recall * best.precision;
      // Một vị trí đạt luật luôn thắng vị trí chưa đạt, dù tích số thấp hơn
      if ((found && (!best.found || better)) || (!best.found && better)) best = { found, recall, precision };
    }
  }

  return best;
}

/** So khớp mẫu logo ở bốn góc của ảnh. Trả về điểm khớp tốt nhất tìm được. */
export async function scanGearvnLogo(image: Buffer): Promise<LogoMatch> {
  const template = await loadTemplate();
  let best: LogoMatch = { found: false, recall: 0, precision: 0 };

  for (const width of SCAN_WIDTHS) {
    const { data, info } = await sharp(image)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .removeAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const raw: RawImage = { data, width: info.width, channels: info.channels };
    const roiWidth = Math.floor(info.width * ROI_X);
    const roiHeight = Math.floor(info.height * ROI_HEIGHT);

    for (const top of [0, info.height - roiHeight]) {
      for (const left of [info.width - roiWidth, 0]) {
        const match = searchRegion(raw, template, left, top, roiWidth, roiHeight);
        if ((match.found && (!best.found || match.recall * match.precision > best.recall * best.precision)) || (!best.found && match.recall * match.precision > best.recall * best.precision)) {
          best = match;
        }
      }
    }

    if (best.found) break;
  }

  return best;
}

/** Lý do loại ảnh nếu dính logo GEARVN, ngược lại null. Dùng làm `reject` của ingestImage. */
export async function rejectRetailerLogo(image: Buffer): Promise<string | null> {
  const match = await scanGearvnLogo(image);
  return match.found ? "có logo GEARVN đóng ở góc ảnh" : null;
}
