import { open } from "node:fs/promises";

/**
 * Kiểm tra "chữ ký" ở đầu file ảnh (magic bytes). Kiểu MIME trong form multipart là do người gửi tự khai nên không đáng
 * tin: một file HTML/SVG gửi kèm `Content-Type: image/png` vẫn lọt qua bộ lọc theo mimetype, rồi được phục vụ công khai
 * ở `/images/banners/`. Đọc đúng vài byte đầu là đủ phân biệt 4 định dạng được nhận.
 */
export function matchesImageSignature(header: Uint8Array, mimetype: string): boolean {
  const startsWith = (bytes: number[], offset = 0) => bytes.every((byte, index) => header[offset + index] === byte);
  const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));

  switch (mimetype) {
    case "image/jpeg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "image/png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "image/gif":
      return startsWith(ascii("GIF87a")) || startsWith(ascii("GIF89a"));
    case "image/webp":
      return startsWith(ascii("RIFF")) && startsWith(ascii("WEBP"), 8);
    default:
      return false;
  }
}

/** Đọc 12 byte đầu của file đã lưu rồi đối chiếu với kiểu MIME người gửi khai */
export async function fileMatchesImageSignature(path: string, mimetype: string): Promise<boolean> {
  const handle = await open(path, "r");
  try {
    const header = new Uint8Array(12);
    const { bytesRead } = await handle.read(header, 0, header.length, 0);
    return matchesImageSignature(header.subarray(0, bytesRead), mimetype);
  } finally {
    await handle.close();
  }
}
