import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./env.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { originGuard } from "./middleware/security.js";
import { authRouter } from "./routes/auth.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { oauthRouter } from "./routes/oauth.routes.js";
import { productsRouter } from "./routes/products.routes.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.corsOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan(env.isDev ? "dev" : "combined"));
  app.use(originGuard);

  /** Kiểm tra API sống hay chưa: curl http://localhost:4000/health */
  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "pczone-api", time: new Date().toISOString() });
  });

  app.use("/api/products", productsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/auth", authRouter);
  // Sau authRouter để /api/auth/me, /login... khớp trước; :provider chỉ nhận google | facebook
  app.use("/api/auth", oauthRouter);
  app.use("/api/cart", cartRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
