/**
 * Tầng ingest: biến một URL ảnh của hãng thành file WebP nằm trên đĩa của PCZone.
 *
 * Vì sao phải tự host thay vì lưu thẳng URL của hãng vào database:
 *
 *   1. Hãng đổi đường dẫn -> ảnh chết hàng loạt, không phục hồi được
 *   2. Hãng chặn Referer -> trang trắng ảnh (code cũ đã phải gửi
 *      `Referer: https://www.asrock.com/` để lách, tức là vấn đề đã hiện hình)
 *   3. Không kiểm soát được kích thước, định dạng -> trang chậm
 *
 * Đáng chú ý: code cũ VỐN ĐÃ tải trọn vẹn file ảnh về RAM (`responseType:
 * "arraybuffer"`) chỉ để kiểm tra ảnh có tồn tại không, rồi vứt đi. Ở đây ta
 * giữ lại đúng số bytes đó — không tốn thêm một request nào.
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import axios from "axios";
import sharp from "sharp";

/*
 * Đọc biến môi trường lúc GỌI HÀM, không phải lúc nạp module.
 *
 * Trong ES module, các lệnh `import` được nâng lên chạy trước mọi câu lệnh
 * khác của file. Nếu đọc env ở cấp module thì giá trị sẽ bị chốt trước khi
 * dotenv kịp nạp `.env`, và mọi cấu hình đều rơi về mặc định.
 */
const storageDir = () => process.env.IMAGE_STORAGE_DIR ?? "public/images/products";
const publicBase = () => process.env.IMAGE_PUBLIC_BASE ?? "/images/products";

/** Ba cỡ đủ dùng cho lưới sản phẩm, trang chi tiết, và ảnh phóng to. */
const SIZES = [
  { name: "thumb", width: 300 },
  { name: "medium", width: 800 },
  { name: "large", width: 1600 },
] as const;

/** Ảnh nhỏ hơn mức này gần như chắc chắn là icon, logo hoặc huy hiệu. */
const MIN_DIMENSION = 400;
const MIN_BYTES = 5 * 1024;

/** Tỷ lệ ngoài khoảng này là biểu ngữ hoặc dải trang trí, không phải ảnh sản phẩm. */
const MIN_ASPECT = 0.3;
const MAX_ASPECT = 3.5;

export interface IngestedImage {
  /** URL công khai để lưu vào ProductImage.url */
  url: string;
  /** Đường dẫn tương đối trong STORAGE_DIR */
  localPath: string;
  remoteUrl: string;
  width: number;
  height: number;
  bytes: number;
  checksum: string;
}

export type IngestOutcome =
  | { status: "OK"; image: IngestedImage }
  | { status: "REJECTED"; reason: string }
  | { status: "DUPLICATE"; checksum: string }
  | { status: "ERROR"; message: string };

const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

async function download(url: string): Promise<Buffer> {
  const origin = new URL(url).origin;

  const response = await axios.get<ArrayBuffer>(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    maxContentLength: 25 * 1024 * 1024,
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "image/avif,image/webp,image/png,image/*,*/*;q=0.8",
      // Một số CDN của hãng từ chối request không có Referer cùng miền
      Referer: `${origin}/`,
    },
  });

  return Buffer.from(response.data);
}

/**
 * Tải một ảnh, kiểm tra chất lượng, chuyển sang WebP 3 cỡ và ghi ra đĩa.
 *
 * @param sku         mã sản phẩm, dùng làm tên thư mục
 * @param remoteUrl   URL ảnh gốc trên CDN của hãng
 * @param seenHashes  các checksum đã gặp ở sản phẩm này, để bỏ ảnh trùng nội dung
 */
export async function ingestImage(
  sku: string,
  remoteUrl: string,
  seenHashes: Set<string>
): Promise<IngestOutcome> {
  let buffer: Buffer;

  try {
    buffer = await download(remoteUrl);
  } catch (error) {
    return {
      status: "ERROR",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (buffer.byteLength < MIN_BYTES) {
    return { status: "REJECTED", reason: `file quá nhỏ (${buffer.byteLength} bytes)` };
  }

  // Trùng nội dung dù URL khác nhau — hay gặp vì cùng một ảnh xuất hiện ở
  // og:image lẫn trong thẻ <img> của thư viện ảnh.
  const checksum = createHash("sha256").update(buffer).digest("hex");
  if (seenHashes.has(checksum)) {
    return { status: "DUPLICATE", checksum };
  }

  /*
   * sharp tự nhận dạng định dạng từ nội dung file, nên URL không có phần mở
   * rộng vẫn xử lý được — cần thiết vì og:image của Gigabyte có dạng
   * .../ProductRemoveBg/33879, không hề có đuôi .png
   *
   * Không khai báo kiểu tường minh: sharp 0.35 dùng `export = sharp`, nên
   * `sharp.Metadata` không truy cập được như namespace dưới moduleResolution
   * NodeNext. Để TypeScript tự suy ra từ giá trị trả về là chắc chắn nhất.
   */
  const meta = await sharp(buffer)
    .metadata()
    .catch(() => null);

  if (!meta) {
    return { status: "REJECTED", reason: "không phải file ảnh hợp lệ" };
  }

  const width = meta.width ?? 0;
  const height = meta.height ?? 0;

  if (width < MIN_DIMENSION || height < MIN_DIMENSION) {
    return { status: "REJECTED", reason: `kích thước quá nhỏ (${width}x${height})` };
  }

  const aspect = width / height;
  if (aspect < MIN_ASPECT || aspect > MAX_ASPECT) {
    return {
      status: "REJECTED",
      reason: `tỷ lệ bất thường ${aspect.toFixed(2)} — có thể là biểu ngữ`,
    };
  }

  // Tên file lấy từ checksum nên chạy lại nhiều lần không sinh rác
  const shortHash = checksum.slice(0, 12);
  const dir = path.join(storageDir(), sku);
  await fs.mkdir(dir, { recursive: true });

  let mediumRelative = "";
  let mediumBytes = 0;
  let mediumWidth = width;
  let mediumHeight = height;

  for (const size of SIZES) {
    const fileName = `${shortHash}-${size.name}.webp`;
    const absolute = path.join(dir, fileName);

    const output = await sharp(buffer)
      // withoutEnlargement: ảnh gốc nhỏ hơn thì giữ nguyên, không phóng to
      // rồi làm vỡ hình
      .resize({ width: size.width, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    await fs.writeFile(absolute, output.data);

    if (size.name === "medium") {
      mediumRelative = path.posix.join(sku, fileName);
      mediumBytes = output.data.byteLength;
      mediumWidth = output.info.width;
      mediumHeight = output.info.height;
    }
  }

  seenHashes.add(checksum);

  return {
    status: "OK",
    image: {
      // Lưu bản medium làm ảnh hiển thị mặc định; thumb và large nằm cùng thư
      // mục, frontend đổi hậu tố là ra.
      url: `${publicBase()}/${mediumRelative}`,
      localPath: mediumRelative,
      remoteUrl,
      width: mediumWidth,
      height: mediumHeight,
      bytes: mediumBytes,
      checksum,
    },
  };
}