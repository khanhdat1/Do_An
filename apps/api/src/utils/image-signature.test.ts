// Kiểm thử nhận diện ảnh theo chữ ký đầu file. Chạy: npx tsx src/utils/image-signature.test.ts
import { matchesImageSignature } from "./image-signature.js";

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

const bytes = (...values: number[]) => Uint8Array.from(values);
const text = (value: string) => Uint8Array.from([...value].map((char) => char.charCodeAt(0)));

const JPEG = bytes(0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01);
const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d);
const GIF = text("GIF89a\x01\x00\x01\x00\x00\x00");
const WEBP = Uint8Array.from([...text("RIFF"), 0x24, 0x00, 0x00, 0x00, ...text("WEBP")]);
const HTML = text("<html><body>");
const SVG = text("<svg xmlns=\"");

console.log("\n[1] Ảnh thật khớp đúng kiểu đã khai");
check("JPEG", matchesImageSignature(JPEG, "image/jpeg"), true);
check("PNG", matchesImageSignature(PNG, "image/png"), true);
check("GIF", matchesImageSignature(GIF, "image/gif"), true);
check("WEBP", matchesImageSignature(WEBP, "image/webp"), true);

console.log("\n[2] Nội dung không phải ảnh, hoặc khai sai kiểu, đều bị từ chối");
check("HTML khai là PNG", matchesImageSignature(HTML, "image/png"), false);
check("SVG khai là JPEG", matchesImageSignature(SVG, "image/jpeg"), false);
check("PNG thật nhưng khai là JPEG", matchesImageSignature(PNG, "image/jpeg"), false);
check("RIFF không phải WEBP (vd WAV)", matchesImageSignature(Uint8Array.from([...text("RIFF"), 0, 0, 0, 0, ...text("WAVE")]), "image/webp"), false);
check("file rỗng", matchesImageSignature(new Uint8Array(0), "image/png"), false);
check("kiểu không nằm trong danh sách nhận", matchesImageSignature(PNG, "image/svg+xml"), false);

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
