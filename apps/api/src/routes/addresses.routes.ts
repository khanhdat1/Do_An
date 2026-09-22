import { Router } from "express";
import { z } from "zod";
import { authenticate, requireAuth } from "../middleware/auth.js";
import { addressWriteLimiter, noStore } from "../middleware/security.js";
import {
  createAddress,
  deleteAddress,
  listAddresses,
  setDefaultAddress,
  updateAddress,
} from "../services/address.service.js";
import { prisma } from "@pczone/db";
import { addressInputSchema } from "../utils/validators.js";

/**
 * Sổ địa chỉ giao hàng — chỉ tài khoản đã đăng nhập mới có (không có phiên bản khách vãng lai,
 * khác giỏ hàng). Dùng ở bước đặt hàng: chọn một địa chỉ đã lưu, hoặc nhập mới rồi lưu luôn.
 */
export const addressesRouter = Router();

addressesRouter.use(noStore, authenticate, requireAuth);

const addressBody = addressInputSchema.extend({ isDefault: z.boolean().default(false) });

const addressIdParam = z.object({ addressId: z.string().min(1).max(40) });

/** GET /api/addresses — mặc định đứng đầu */
addressesRouter.get("/", async (req, res, next) => {
  try {
    res.json({ items: await listAddresses(req.auth!.userId) });
  } catch (error) {
    next(error);
  }
});

/** POST /api/addresses */
addressesRouter.post("/", addressWriteLimiter, async (req, res, next) => {
  try {
    const { isDefault, ...input } = addressBody.parse(req.body);
    res.status(201).json(await createAddress(prisma, req.auth!.userId, input, isDefault));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/addresses/:addressId — sửa toàn bộ thông tin (không đổi mặc định qua đây, dùng route riêng bên dưới) */
addressesRouter.patch("/:addressId", addressWriteLimiter, async (req, res, next) => {
  try {
    const { addressId } = addressIdParam.parse(req.params);
    const { isDefault: _ignored, ...input } = addressBody.partial().parse(req.body);
    res.json(await updateAddress(req.auth!.userId, addressId, input));
  } catch (error) {
    next(error);
  }
});

/** PATCH /api/addresses/:addressId/default */
addressesRouter.patch("/:addressId/default", addressWriteLimiter, async (req, res, next) => {
  try {
    const { addressId } = addressIdParam.parse(req.params);
    res.json(await setDefaultAddress(req.auth!.userId, addressId));
  } catch (error) {
    next(error);
  }
});

/** DELETE /api/addresses/:addressId */
addressesRouter.delete("/:addressId", addressWriteLimiter, async (req, res, next) => {
  try {
    const { addressId } = addressIdParam.parse(req.params);
    await deleteAddress(req.auth!.userId, addressId);
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});
