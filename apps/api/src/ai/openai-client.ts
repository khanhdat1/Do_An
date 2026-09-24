import OpenAI, { APIError } from "openai";
import { env } from "../env.js";
import { ServiceUnavailableError } from "../middleware/errors.js";

let client: OpenAI | null = null;
function openaiClient(): OpenAI {
  client ??= new OpenAI({ apiKey: env.ai.openaiApiKey });
  return client;
}

/** AI Search dùng cái này để tự quyết định lùi về tìm kiếm từ khoá; AI Chat/Build PC báo lỗi rõ thay vì giả vờ chạy được */
export function isConfigured(): boolean {
  return Boolean(env.ai.openaiApiKey);
}

function requireConfigured(): void {
  if (!isConfigured()) throw new ServiceUnavailableError("Tính năng AI chưa được cấu hình.");
}

/** OpenAI 429 khá hay gặp thoáng qua — thử lại đúng một lần trước khi báo lỗi hẳn */
async function callWithRetry<T>(action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    if (error instanceof APIError && error.status === 429) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      try {
        return await action();
      } catch (retryError) {
        throw mapError(retryError);
      }
    }
    throw mapError(error);
  }
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

/** Gộp nhiều văn bản vào một lượt gọi — trả về đúng thứ tự đầu vào (sắp lại theo `index` cho chắc) */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  requireConfigured();
  if (texts.length === 0) return [];
  const response = await callWithRetry(() => openaiClient().embeddings.create({ model: env.ai.embeddingModel, input: texts }));
  return [...response.data].sort((a, b) => a.index - b.index).map((item) => item.embedding);
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
