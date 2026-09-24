/**
 * Gọi `POST /api/ai/chat` và đọc SSE thô qua `response.body.getReader()` — không dùng `EventSource`
 * (không POST được body), không dùng thư viện ngoài. `apiFetch` (api-client.ts) không dùng được ở
 * đây vì nó luôn gọi `response.json()`; nhưng vẫn tái dùng `renewSession`/`toApiError` từ đó thay vì
 * viết lại logic refresh-401/đọc lỗi JSON.
 */
import type { Product } from "@/types";
import { renewSession, toApiError } from "./api-client";
import { PUBLIC_API_URL } from "./config";

export interface ChatStreamCallbacks {
  onMeta(data: { conversationId: string; userMessageId: string }): void;
  onChunk(text: string): void;
  onDone(data: { citedProductIds: string[]; citedProducts: Product[]; messageId: string | null }): void;
  onError(message: string): void;
}

type SseEvent =
  | { type: "meta"; conversationId: string; userMessageId: string }
  | { type: "chunk"; text: string }
  | { type: "done"; citedProductIds: string[]; citedProducts: Product[]; messageId: string | null }
  | { type: "error"; message: string };

const GENERIC_ERROR = "Không kết nối được với trợ lý AI. Vui lòng thử lại.";

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function postChat(input: { conversationId?: string; message: string }, signal: AbortSignal | undefined): Promise<Response> {
  return fetch(`${PUBLIC_API_URL}/api/ai/chat`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify(input),
    signal,
  });
}

export async function streamChatMessage(input: { conversationId?: string; message: string }, callbacks: ChatStreamCallbacks, signal?: AbortSignal): Promise<void> {
  let response: Response;
  try {
    response = await postChat(input, signal);
  } catch (error) {
    if (isAbortError(error)) return;
    callbacks.onError(GENERIC_ERROR);
    return;
  }

  // Token hết hạn giữa phiên (route cho khách vãng lai vào được, nhưng token CÓ mà hết hạn vẫn 401
  // — xem middleware/auth.ts): refresh rồi thử lại đúng một lần, giống apiFetch.
  if (response.status === 401) {
    const renewed = await renewSession();
    if (renewed) {
      try {
        response = await postChat(input, signal);
      } catch (error) {
        if (isAbortError(error)) return;
        callbacks.onError(GENERIC_ERROR);
        return;
      }
    }
  }

  if (!response.ok) {
    callbacks.onError((await toApiError(response)).message);
    return;
  }
  if (!response.body) {
    callbacks.onError(GENERIC_ERROR);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawTerminalEvent = false;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let separatorIndex: number;
      while ((separatorIndex = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, separatorIndex);
        buffer = buffer.slice(separatorIndex + 2);

        const dataLine = frame.split("\n").find((line) => line.startsWith("data: "));
        if (!dataLine) continue;

        let event: SseEvent;
        try {
          event = JSON.parse(dataLine.slice("data: ".length)) as SseEvent;
        } catch {
          continue;
        }

        if (event.type === "meta") {
          callbacks.onMeta(event);
        } else if (event.type === "chunk") {
          callbacks.onChunk(event.text);
        } else if (event.type === "done") {
          sawTerminalEvent = true;
          callbacks.onDone(event);
        } else if (event.type === "error") {
          sawTerminalEvent = true;
          callbacks.onError(event.message);
        }
      }
    }
  } catch (error) {
    if (isAbortError(error)) return;
    if (!sawTerminalEvent) callbacks.onError(GENERIC_ERROR);
    return;
  }

  // Kết nối kết thúc mà chưa từng thấy "done"/"error" — coi như mất kết nối giữa chừng
  if (!sawTerminalEvent) callbacks.onError(GENERIC_ERROR);
}
