import { randomBytes } from "node:crypto";
import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** Sản phẩm có sẵn trong `packages/db/prisma/seed.ts` — DB kiểm thử được nạp lại từ đúng file đó ở mỗi lượt chạy */
export const MOUSE = {
  slug: "logitech-g-pro-x-superlight-2",
  name: "Logitech G Pro X Superlight 2 Hero 2 32K",
  price: "3.490.000đ",
};
export const CPU_9700X = { slug: "cpu-amd-ryzen-7-9700x", name: "CPU AMD Ryzen 7 9700X AM5 Zen 5", price: "9.290.000đ" };
export const PC_ULTRA = { slug: "pc-gaming-pczone-ultra-master-g7", name: "PC Gaming PCZone Ultra Master G7" };
export const PC_DRAGON = { slug: "pc-gaming-pczone-dragon-knight", name: "PC Gaming PCZone Dragon Knight" };

/** Tài khoản quản trị mẫu do seed.ts tạo (README mục 12) — ở đây chỉ dùng trên DB kiểm thử */
const SEED_ADMIN = { email: "admin@pczone.vn", password: "admin123" };

/** Trùng `DEFAULT_SETTINGS` ở apps/api/src/settings/system-settings.ts — trạng thái đầu của mọi lượt chạy */
export const DEFAULT_SETTINGS = {
  store: { hotline: "1800 8888", supportEmail: "support@pczone.vn", showroomAddress: "" },
  shipping: { flatFee: 30_000, freeThreshold: 500_000 },
  payments: { cod: true, vnpay: true, bankTransfer: true, momo: true },
  ai: { search: true, chat: true, build: true },
};

export const TEST_ADDRESS = {
  recipientName: "Khách Kiểm Thử",
  phone: "0912345678",
  province: "Hà Nội",
  district: "Cầu Giấy",
  ward: "Dịch Vọng",
  streetAddress: "Số 1, đường Xuân Thuỷ",
};

let emailCounter = 0;

/** Email không trùng giữa các lượt chạy; đuôi example.com là tên miền dành riêng cho ví dụ — không có hộp thư thật */
export function uniqueEmail(tag: string): string {
  emailCounter += 1;
  return `e2e-${tag}-${Date.now()}-${emailCounter}@example.com`;
}

/** Mật khẩu ngẫu nhiên cho khách tạo trong lượt chạy (đủ luật: ≥ 8 ký tự, có cả chữ và số) */
export function randomPassword(): string {
  return `Kt${randomBytes(9).toString("base64url")}9`;
}

/** Đăng ký khách mới qua đúng form /dang-ky — xong thì đang đăng nhập, đứng ở trang Tài khoản */
export async function registerCustomerViaUi(page: Page, fullName: string): Promise<string> {
  const email = uniqueEmail("khach");
  const password = randomPassword();

  await page.goto("/dang-ky?next=/tai-khoan");
  await page.getByLabel(/^Họ và tên/).fill(fullName);
  await page.getByLabel(/^Email/).fill(email);
  await page.getByLabel(/^Mật khẩu/).fill(password);
  await page.getByLabel(/^Nhập lại mật khẩu/).fill(password);
  await page.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page).toHaveURL(/\/tai-khoan$/);
  return email;
}

/** Đăng ký khách mới thẳng qua API — cookie phiên nằm lại trong `request`, gọi tiếp API khác là đã đăng nhập */
export async function registerCustomerViaApi(request: APIRequestContext, fullName: string): Promise<string> {
  const email = uniqueEmail("api");
  const response = await request.post("/api/auth/register", { data: { fullName, email, password: randomPassword() } });
  expect(response.status(), await response.text()).toBe(201);
  return email;
}

/** Đăng nhập quản trị thẳng qua API — cookie phiên quản trị nằm lại trong `request` */
export async function loginAdminViaApi(request: APIRequestContext): Promise<void> {
  const response = await request.post("/api/admin/auth/login", { data: SEED_ADMIN });
  expect(response.ok(), await response.text()).toBe(true);
  expect(((await response.json()) as { status: string }).status).toBe("ok");
}

export async function loginAdmin(page: Page): Promise<void> {
  await page.goto("/admin/login");
  await page.locator("#admin-email").fill(SEED_ADMIN.email);
  await page.locator("#admin-password").fill(SEED_ADMIN.password);
  await page.getByRole("button", { name: "Đăng nhập", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

/** Mở trang sản phẩm, bấm "Thêm vào giỏ" và chờ API giỏ hàng xác nhận */
export async function addToCart(page: Page, slug: string): Promise<void> {
  await page.goto(`/san-pham/${slug}`);
  const added = page.waitForResponse(
    (response) => response.url().endsWith("/api/cart/items") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Thêm vào giỏ" }).first().click();
  expect((await added).ok()).toBe(true);
}

/** Tạo nhanh một đơn COD qua API cho khách đang đăng nhập trong `request` — trả mã đơn */
export async function placeCodOrderViaApi(request: APIRequestContext, slug: string): Promise<string> {
  const product = await request.get(`/api/products/${slug}`);
  expect(product.ok()).toBe(true);
  const { id } = (await product.json()) as { id: string };

  const cart = await request.post("/api/cart/items", { data: { productId: id, quantity: 1 } });
  expect(cart.ok(), await cart.text()).toBe(true);

  const order = await request.post("/api/orders", {
    data: { newAddress: { ...TEST_ADDRESS, saveAsDefault: false }, paymentMethod: "COD" },
  });
  expect(order.status(), await order.text()).toBe(201);
  return ((await order.json()) as { order: { orderCode: string } }).order.orderCode;
}
