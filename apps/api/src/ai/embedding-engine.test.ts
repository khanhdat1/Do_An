/**
 * Kiểm thử xếp hạng cosine similarity bằng vector giả, không cần DB hay mạng. Chạy: npx tsx src/ai/embedding-engine.test.ts
 */
import { cosineSimilarity, rankBySimilarity } from "./embedding-engine.js";

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

console.log("\n[1] cosineSimilarity");
{
  check("hai vector giống hệt nhau -> 1", cosineSimilarity([1, 0, 0], [1, 0, 0]), 1);
  check("hai vector cùng hướng khác độ lớn -> 1", cosineSimilarity([1, 2, 3], [2, 4, 6]), 1);
  check("hai vector vuông góc -> 0", cosineSimilarity([1, 0], [0, 1]), 0);
  check("hai vector ngược hướng -> -1", cosineSimilarity([1, 0], [-1, 0]), -1);
  check("vector toàn số 0 -> 0 (không chia cho 0)", cosineSimilarity([0, 0, 0], [1, 2, 3]), 0);
}

console.log("\n[2] rankBySimilarity");
{
  const docs = [
    { productId: "giong-het", vector: [1, 0, 0] },
    { productId: "gan-giong", vector: [0.9, 0.1, 0] },
    { productId: "khong-lien-quan", vector: [0, 1, 0] },
    { productId: "nguoc-huong", vector: [-1, 0, 0] },
  ];
  const ranked = rankBySimilarity([1, 0, 0], docs, 10);
  check("xếp đúng thứ tự từ giống nhất tới ít giống nhất", ranked.map((r) => r.productId), ["giong-het", "gan-giong", "khong-lien-quan", "nguoc-huong"]);
  check("điểm cao nhất là 1 (giống hệt)", ranked[0]?.score, 1);

  const limited = rankBySimilarity([1, 0, 0], docs, 2);
  check("giới hạn đúng số lượng kết quả", limited.length, 2);
  check("limit vẫn giữ đúng 2 kết quả tốt nhất", limited.map((r) => r.productId), ["giong-het", "gan-giong"]);
}

console.log(`\n===== ${passed} pass / ${failed} fail =====`);
if (failed > 0) process.exit(1);
