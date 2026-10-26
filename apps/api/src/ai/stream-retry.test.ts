/**
 * Kiểm thử thử lại luồng trả lời khi hỏng trước chữ đầu tiên (`stream-retry.ts`) bằng luồng giả, không cần mạng hay AI.
 * Chạy: npx tsx src/ai/stream-retry.test.ts
 */
import { EmptyStreamError, FirstChunkTimeoutError, retryBeforeFirstChunk } from "./stream-retry.js";

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

/** Luồng giả: phát lần lượt các phần, gặp Error thì ném ra đúng chỗ đó; `hang` = treo mãi trước phần đầu tiên */
async function* fake(parts: (string | Error)[], hang = false): AsyncGenerator<string> {
  if (hang) await new Promise(() => undefined);
  for (const part of parts) {
    if (part instanceof Error) throw part;
    yield part;
  }
}

async function collect(stream: AsyncIterable<string>): Promise<{ text: string; error?: string }> {
  let text = "";
  try {
    for await (const part of stream) text += part;
    return { text };
  } catch (error) {
    return { text, error: error instanceof Error ? error.name : String(error) };
  }
}

function run(attempts: (string | Error)[][], options: { maxAttempts?: number; hangFirst?: boolean; timeoutMs?: number } = {}) {
  const retries: number[] = [];
  const opened: number[] = [];
  const stream = retryBeforeFirstChunk(
    (attempt) => {
      opened.push(attempt);
      return fake(attempts[attempt - 1] ?? [], options.hangFirst === true && attempt === 1);
    },
    { maxAttempts: options.maxAttempts ?? 2, firstChunkTimeoutMs: options.timeoutMs, onRetry: (attempt) => retries.push(attempt) },
  );
  return { stream, retries, opened };
}

console.log("\n[1] Không lỗi: không thử lại");
{
  const { stream, retries, opened } = run([["Xin ", "chào"]]);
  check("nhận đủ câu trả lời", await collect(stream), { text: "Xin chào" });
  check("chỉ mở một luồng", [opened, retries], [[1], []]);
}

console.log("\n[2] Hỏng trước chữ đầu tiên: thử lại, khách chỉ thấy câu trả lời lần sau");
{
  const { stream, retries, opened } = run([[new Error("503")], ["Câu ", "trả lời"]]);
  check("câu trả lời là của lần thử thứ hai", await collect(stream), { text: "Câu trả lời" });
  check("thử lại đúng một lần", [opened, retries], [[1, 2], [1]]);
}

console.log("\n[3] Đã có chữ rồi mới hỏng: KHÔNG thử lại (không ghép hai câu trả lời)");
{
  const { stream, retries, opened } = run([["Đang trả lời", new Error("mất kết nối")], ["Lần sau"]]);
  check("giữ phần đã nhận, báo lỗi", await collect(stream), { text: "Đang trả lời", error: "Error" });
  check("không mở luồng thứ hai", [opened, retries], [[1], []]);
}

console.log("\n[4] Hỏng ở mọi lần thử: báo lỗi của lần cuối");
{
  const { stream, opened } = run([[new Error("503")], [new Error("504")]]);
  check("báo lỗi, không có chữ", await collect(stream), { text: "", error: "Error" });
  check("thử đúng số lần cho phép", opened, [1, 2]);
}

console.log("\n[5] Luồng rỗng được coi như hỏng");
{
  const { stream, retries } = run([[], ["Có rồi"]]);
  check("thử lại khi luồng rỗng", [await collect(stream), retries], [{ text: "Có rồi" }, [1]]);
  const once = run([[]], { maxAttempts: 1 });
  check("hết lượt thì báo EmptyStreamError", await collect(once.stream), { text: "", error: new EmptyStreamError().name });
}

console.log("\n[6] Treo không trả chữ nào: hết hạn chờ thì bỏ lần đó và thử lại");
{
  const started = Date.now();
  const { stream, retries } = run([[], ["Trả lời sau khi treo"]], { hangFirst: true, timeoutMs: 50 });
  check("lần hai trả lời được", await collect(stream), { text: "Trả lời sau khi treo" });
  check("lần một bị bỏ vì hết hạn", retries, [1]);
  check("không chờ quá lâu (< 1 giây)", Date.now() - started < 1000, true);
  const stuck = run([[]], { hangFirst: true, timeoutMs: 30, maxAttempts: 1 });
  check("treo ở lần cuối thì báo hết hạn", await collect(stuck.stream), { text: "", error: new FirstChunkTimeoutError(30).name });
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
