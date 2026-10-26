/**
 * Thử lại một luồng trả lời (stream) khi nó hỏng TRƯỚC chữ đầu tiên — hàm thuần, không phụ thuộc thư viện AI, để kiểm thử.
 *
 * Gặp thật ở trợ lý AI: API đã truy hồi xong sau chưa tới 1 giây nhưng Gemini im lặng tới hết thời gian chờ rồi báo lỗi, khách
 * thấy "Trợ lý AI bị gián đoạn" và phải tự gửi lại; gửi lại ngay thì thường trả lời bình thường. Chưa có chữ nào gửi tới trình
 * duyệt thì thử lại hoàn toàn trong suốt với khách. Đã có chữ thì KHÔNG thử lại: không rút lại được phần đã hiện, ghép hai câu trả
 * lời khác nhau sẽ ra một câu vô nghĩa — để lỗi đi lên như cũ.
 */
export interface RetryBeforeFirstChunkOptions {
  /** Tổng số lần thử, kể cả lần đầu */
  maxAttempts: number;
  /** Mỗi lần thử phải có chữ đầu tiên trong chừng này mili giây, quá thì bỏ lần đó (tính cả thời gian mở kết nối) */
  firstChunkTimeoutMs?: number;
  /** Nghỉ giữa hai lần thử */
  delayMs?: number;
  onRetry?: (failedAttempt: number, error: unknown) => void;
}

export class FirstChunkTimeoutError extends Error {
  constructor(ms: number) {
    super(`Không nhận được chữ đầu tiên sau ${ms} ms`);
    this.name = "FirstChunkTimeoutError";
  }
}

/** Luồng kết thúc mà không có chữ nào — coi như lỗi để được thử lại, thay vì trả về một câu trả lời rỗng */
export class EmptyStreamError extends Error {
  constructor() {
    super("Luồng trả lời kết thúc mà không có nội dung");
    this.name = "EmptyStreamError";
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number | undefined, onTimeout: () => void): Promise<T> {
  if (ms === undefined) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new FirstChunkTimeoutError(ms));
    }, Math.max(0, ms));
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * `open(attempt, signal)` mở một luồng mới cho lần thử thứ `attempt` (bắt đầu từ 1); `signal` bị huỷ khi lần thử đó quá hạn,
 * truyền thẳng vào request để không bỏ lại kết nối treo. Trả về đúng các phần của MỘT lần thử thành công.
 */
export async function* retryBeforeFirstChunk<T>(
  open: (attempt: number, signal: AbortSignal) => AsyncIterable<T> | Promise<AsyncIterable<T>>,
  options: RetryBeforeFirstChunkOptions,
): AsyncGenerator<T> {
  for (let attempt = 1; ; attempt++) {
    let started = false;
    let iterator: AsyncIterator<T> | undefined;
    const controller = new AbortController();
    const startedAt = Date.now();
    const remaining = () => (options.firstChunkTimeoutMs === undefined ? undefined : options.firstChunkTimeoutMs - (Date.now() - startedAt));
    const abandon = () => {
      // Huỷ kết nối đang treo; lỗi lúc huỷ không quan trọng
      controller.abort();
      void iterator?.return?.()?.catch?.(() => undefined);
    };

    try {
      const iterable = await withTimeout(Promise.resolve(open(attempt, controller.signal)), remaining(), abandon);
      iterator = iterable[Symbol.asyncIterator]();
      const first = await withTimeout(iterator.next(), remaining(), abandon);
      if (first.done) throw new EmptyStreamError();
      started = true;
      yield first.value;
      while (true) {
        const next = await iterator.next();
        if (next.done) return;
        yield next.value;
      }
    } catch (error) {
      if (started || attempt >= options.maxAttempts) throw error;
      options.onRetry?.(attempt, error);
      if (options.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
  }
}
