import type { AccessTokenClaims } from "../services/token.service.js";

declare global {
  namespace Express {
    interface Request {
      /** Có giá trị khi request mang access token hợp lệ (xem middleware/auth.ts) */
      auth?: AccessTokenClaims;
    }
  }
}

export {};
