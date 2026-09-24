import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./env.js";
import { errorHandler, notFoundHandler } from "./middleware/errors.js";
import { originGuard } from "./middleware/security.js";
import { addressesRouter } from "./routes/addresses.routes.js";
import { adminAccountsRouter } from "./routes/admin-accounts.routes.js";
import { adminAuthRouter } from "./routes/admin-auth.routes.js";
import { adminBannersRouter } from "./routes/admin-banners.routes.js";
import { adminCustomersRouter } from "./routes/admin-customers.routes.js";
import { adminDashboardRouter } from "./routes/admin-dashboard.routes.js";
import { adminOrdersRouter } from "./routes/admin-orders.routes.js";
import { adminProductsRouter } from "./routes/admin-products.routes.js";
import { adminReviewsRouter } from "./routes/admin-reviews.routes.js";
import { adminVouchersRouter } from "./routes/admin-vouchers.routes.js";
import { aiChatRouter } from "./routes/ai-chat.routes.js";
import { aiSearchRouter } from "./routes/ai-search.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { bannersRouter } from "./routes/banners.routes.js";
import { cartRouter } from "./routes/cart.routes.js";
import { categoriesRouter } from "./routes/categories.routes.js";
import { oauthRouter } from "./routes/oauth.routes.js";
import { orderLookupRouter } from "./routes/order-lookup.routes.js";
import { ordersRouter } from "./routes/orders.routes.js";
import { paymentsRouter } from "./routes/payments.routes.js";
import { productsRouter } from "./routes/products.routes.js";
import { reviewsRouter } from "./routes/reviews.routes.js";
import { searchRouter } from "./routes/search.routes.js";
import { vouchersRouter } from "./routes/vouchers.routes.js";
import { wishlistRouter } from "./routes/wishlist.routes.js";

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
  // Cùng tiền tố với productsRouter (giống auth+oauth cùng dùng /api/auth) — không đụng nhau vì
  // :slug của productsRouter chỉ khớp đúng một đoạn đường dẫn, không khớp /:slug/reviews
  app.use("/api/products", reviewsRouter);
  app.use("/api/categories", categoriesRouter);
  app.use("/api/search", searchRouter);
  app.use("/api/ai", aiSearchRouter);
  app.use("/api/ai", aiChatRouter);
  app.use("/api/vouchers", vouchersRouter);
  app.use("/api/banners", bannersRouter);
  app.use("/api/auth", authRouter);
  // Sau authRouter để /api/auth/me, /login... khớp trước; :provider chỉ nhận google | facebook
  app.use("/api/auth", oauthRouter);
  app.use("/api/cart", cartRouter);
  app.use("/api/addresses", addressesRouter);
  app.use("/api/wishlist", wishlistRouter);
  app.use("/api/orders", ordersRouter);
  app.use("/api/order-lookup", orderLookupRouter);
  app.use("/api/payments", paymentsRouter);
  app.use("/api/admin/accounts", adminAccountsRouter);
  app.use("/api/admin/auth", adminAuthRouter);
  app.use("/api/admin/banners", adminBannersRouter);
  app.use("/api/admin/customers", adminCustomersRouter);
  app.use("/api/admin/dashboard", adminDashboardRouter);
  app.use("/api/admin/orders", adminOrdersRouter);
  app.use("/api/admin/products", adminProductsRouter);
  app.use("/api/admin/reviews", adminReviewsRouter);
  app.use("/api/admin/vouchers", adminVouchersRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
