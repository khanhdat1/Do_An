import { z } from "zod";

/**
 * Boolean trong query string.
 *
 * KHÔNG dùng z.coerce.boolean(): nó chạy Boolean("false") = true, nên
 * `?featured=false` sẽ bị hiểu thành true. Phải so khớp chuỗi tường minh.
 */
export const boolQuery = z
  .enum(["true", "false", "1", "0"])
  .transform((value) => value === "true" || value === "1")
  .optional();
