import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/**
 * `next build` viết lại `apps/web/next-env.d.ts` trỏ sang kiểu của bản build (`.next/types`), còn bản trong git trỏ
 * sang bản dev (`.next/dev/types`) — trả về như cũ để chạy kiểm thử xong không để lại thay đổi nào trong git.
 */
const NEXT_ENV_PATH = fileURLToPath(new URL("../web/next-env.d.ts", import.meta.url));

export default function globalTeardown(): void {
  const current = readFileSync(NEXT_ENV_PATH, "utf8");
  const restored = current.replace(/"\.\/\.next\/types\//g, '"./.next/dev/types/');
  if (restored !== current) writeFileSync(NEXT_ENV_PATH, restored);
}
