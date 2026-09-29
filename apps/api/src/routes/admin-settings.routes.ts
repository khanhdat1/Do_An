import { Router } from "express";
import { authenticateAdmin, requireAuth } from "../middleware/auth.js";
import { requirePermission } from "../middleware/permissions.js";
import { adminWriteLimiter, noStore } from "../middleware/security.js";
import { getAdminSettings, updateSettings } from "../services/settings.service.js";
import { systemSettingsSchema } from "../settings/system-settings.js";

/**
 * Cài đặt hệ thống — cả ĐỌC lẫn GHI đều cần `settings:write` (chỉ OWNER; MANAGER bị loại khỏi quyền này từ Đợt 1).
 * Trang này lộ cả tình trạng cấu hình .env (phương thức nào thiếu khoá) nên không mở cho vai trò khác xem.
 */
export const adminSettingsRouter = Router();

adminSettingsRouter.use(noStore, authenticateAdmin, requireAuth);

/** GET /api/admin/settings */
adminSettingsRouter.get("/", requirePermission("settings:write"), async (_req, res, next) => {
  try {
    res.json(await getAdminSettings());
  } catch (error) {
    next(error);
  }
});

/** PUT /api/admin/settings — body đủ 4 nhóm { store, shipping, payments, ai }, thay thế nguyên bộ */
adminSettingsRouter.put("/", requirePermission("settings:write"), adminWriteLimiter, async (req, res, next) => {
  try {
    const input = systemSettingsSchema.parse(req.body);
    res.json(await updateSettings(input, req.auth!));
  } catch (error) {
    next(error);
  }
});
