import OpenAI, { APIError } from "openai";
import { env } from "../env.js";
import { ServiceUnavailableError } from "../middleware/errors.js";

// SDK mặc định timeout 10 PHÚT (OpenAI.DEFAULT_TIMEOUT = 600000ms) — hợp lý cho việc chạy nền, nhưng
// với AI Chat có người dùng đang chờ trực tiếp, một lượt Gemini bị quá tải "treo" (không trả 503 nhanh
// mà im lặng không phản hồi) sẽ bắt người dùng đợi tới 10 phút mới thấy lỗi. Rút ngắn để lỗi/timeout
// hiện ra trong thời gian một người thật còn kiên nhẫn chờ.
const REQUEST_TIMEOUT_MS = 30_000;

let client: OpenAI | null = null;
function openaiClient(): OpenAI {
  // maxRetries: 0 — SDK mặc định TỰ retry 2 lần (worst-case 3 lượt gọi thật cho một lần request logic,
  // đã thực tế gặp: một câu hỏi chat "treo" gần trọn timeout × nhiều lần trước khi lỗi thật sự lộ ra).
  // callWithRetry() bên dưới đã tự quyết định retry khi nào/bao nhiêu lần theo TỪNG loại lỗi (429 với
  // embed()/chatComplete() thì thử lại 1 lần; embedBatch() cố ý KHÔNG thử lại — xem ghi chú ở đó) —
  // để SDK retry ngầm thêm một lớp nữa phá vỡ đúng những quyết định đó mà không hề biết.
  // baseURL undefined -> gói `openai` tự dùng địa chỉ thật của OpenAI (xem ghi chú ở env.ts)
  client ??= new OpenAI({ apiKey: env.ai.openaiApiKey, baseURL: env.ai.baseUrl, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  return client;
}

/** AI Search dùng cái này để tự quyết định lùi về tìm kiếm từ khoá; AI Chat/Build PC báo lỗi rõ thay vì giả vờ chạy được */
export function isConfigured(): boolean {
  return Boolean(env.ai.openaiApiKey);
}

function requireConfigured(): void {
  if (!isConfigured()) throw new ServiceUnavailableError("Tính năng AI chưa được cấu hình.");
}

/**
 * 429 khá hay gặp thoáng qua. Mặc định thử lại 2 lần (đủ cho các lời gọi người dùng đang chờ —
 * `embed()`/`chatComplete()`/`chatCompleteStream()` — không nên bắt họ đợi quá lâu, thà báo lỗi để
 * rơi về tìm kiếm thường/hiện nút thử lại còn hơn). `embedBatch()` dựng chỉ mục nền lúc khởi động thì
 * không ai đang chờ trực tiếp, nên truyền `maxAttempts`/`delayMs` khác hẳn (xem `EMBED_BATCH_LIMIT`).
 *
 * Cũng thử lại với MỌI lỗi 5xx, không chỉ 429: gặp thực tế nhiều lần model Gemini free-tier báo
 * "currently experiencing high demand... temporary" (503) — đúng nghĩa HTTP chuẩn của 503 (tạm thời
 * không phục vụ được, nên thử lại), không phải lỗi PCZone hay lỗi cấu hình.
 */
async function callWithRetry<T>(action: () => Promise<T>, opts: { maxAttempts?: number; delayMs?: number } = {}): Promise<T> {
  const { maxAttempts = 3, delayMs = 1500 } = opts;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await action();
    } catch (error) {
      const isRetryable = error instanceof APIError && (error.status === 429 || (error.status !== undefined && error.status >= 500));
      if (!isRetryable || attempt === maxAttempts) throw mapError(error);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw new ServiceUnavailableError("Dịch vụ AI hiện không phản hồi được. Vui lòng thử lại sau.");
}

/**
 * 400 (request sai) là lỗi của PCZone, không phải dịch vụ ngoài — trả nguyên lỗi để rơi vào 500
 * chung, không giả vờ là "OpenAI đang lỗi". Mọi trường hợp khác (401/403/404/409/422/429 sau khi đã
 * thử lại/5xx/mất kết nối) người dùng không tự sửa được — báo `ServiceUnavailableError` (503), ghi
 * log đầy đủ ở server để tự kiểm tra.
 */
function mapError(error: unknown): unknown {
  if (error instanceof APIError && error.status === 400) return error;

  const status = error instanceof APIError ? error.status : undefined;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`OpenAI API lỗi${status ? ` (status ${status})` : ""}:`, message);
  return new ServiceUnavailableError("Dịch vụ AI hiện không phản hồi được. Vui lòng thử lại sau.");
}

export async function embed(text: string): Promise<number[]> {
  requireConfigured();
  const response = await callWithRetry(() => openaiClient().embeddings.create({ model: env.ai.embeddingModel, input: text }));
  const embedding = response.data[0]?.embedding;
  if (!embedding) throw new ServiceUnavailableError("Dịch vụ AI trả về kết quả không hợp lệ.");
  return embedding;
}

// Gemini giới hạn cứng 100 input/lượt gọi (BatchEmbedContentsRequest). Chia nhỏ hơn nữa (50) để một
// chỗ nghẽn không huỷ mất công của nhiều sản phẩm cùng lúc — export ra để embedding-store.ts dùng
// đúng cùng kích thước khi tự chia đợt ghi DB dần (chunk nào lỡ xong thì giữ nguyên, không mất).
export const EMBED_BATCH_LIMIT = 50;

/**
 * Gộp nhiều văn bản, tự chia thành nhiều lượt gọi theo `EMBED_BATCH_LIMIT` — trả về đúng thứ tự đầu
 * vào (sắp lại theo `index` cho chắc trong từng lượt).
 *
 * KHÔNG thử lại khi 429 (khác `embed()`/`chatComplete()` vẫn thử lại 1 lần): đã thực tế gặp free-tier
 * Gemini báo "embed_content_free_tier_requests" — thời gian đề nghị chờ TĂNG DẦN qua mỗi lần thử lại
 * (5.7s → 23.7s → 33.9s dù cách nhau chỉ vài chục giây), tức đây không phải kiểu giới hạn hồi nhanh
 * theo phút mà thử lại vài giây là qua được — cứ thử lại chỉ tốn thêm quota (hoặc thêm request tính
 * vào cùng hạn mức) mà không giúp gì. Thất bại thì dừng ngay, để `embedding-store.ts` tự nghỉ một lúc
 * (`FAILURE_COOLDOWN_MS`) rồi mới thử lại toàn bộ, thay vì dội liên tục ngay trong một lượt dựng.
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  requireConfigured();
  if (texts.length === 0) return [];

  const results: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH_LIMIT) {
    const chunk = texts.slice(i, i + EMBED_BATCH_LIMIT);
    const response = await callWithRetry(() => openaiClient().embeddings.create({ model: env.ai.embeddingModel, input: chunk }), { maxAttempts: 1 });
    results.push(...[...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding));
  }
  return results;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Chưa dùng ở Đợt 1 (AI Search chỉ cần embed) — dựng sẵn cho AI Chat ở Đợt 2, cùng một client nên dựng luôn cho đỡ quay lại */
export async function chatComplete(messages: ChatMessage[]): Promise<string> {
  requireConfigured();
  const response = await callWithRetry(() => openaiClient().chat.completions.create({ model: env.ai.chatModel, messages }));
  return response.choices[0]?.message?.content ?? "";
}

/**
 * Lỗi TRƯỚC khi có token nào trả về thì `callWithRetry` xử lý như bình thường (ném lỗi rõ ràng).
 * Lỗi GIỮA CHỪNG (sau khi đã bắt đầu stream) không đi qua đây được nữa — response đã cam kết 200
 * text/event-stream rồi, bên gọi (route) phải tự bắt exception từ vòng lặp `for await` và ghi một
 * sự kiện SSE lỗi thay vì đổi mã trạng thái HTTP.
 */
export async function* chatCompleteStream(messages: ChatMessage[]): AsyncGenerator<string> {
  requireConfigured();
  const stream = await callWithRetry(() => openaiClient().chat.completions.create({ model: env.ai.chatModel, messages, stream: true }));
  for await (const chunk of stream) {
    const delta = chunk.choices[0]?.delta?.content;
    if (delta) yield delta;
  }
}
