import { expect, test, type APIRequestContext, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import { loginAdmin, MOUSE, placeCodOrderViaApi, randomPassword, seriousViolations, uniqueEmail } from "./helpers";

/**
 * Quản lý khách hàng (giao diện tối, `/admin/customers`): 4 thao tác trên mỗi tài khoản — sửa thông tin, khoá/mở khoá
 * kèm lý do (khách bị đăng xuất NGAY), cấp lại mật khẩu, xoá. Quản trị thao tác qua đúng giao diện; phía khách là một
 * phiên API riêng để kiểm tra hậu quả thật (bị đăng xuất, đăng nhập lại được hay không). Khi hộp thoại đang mở, quét
 * axe-core để chắc giao diện tối vẫn đạt tương phản WCAG AA.
 */

interface Customer {
  api: APIRequestContext;
  id: string;
  email: string;
  password: string;
  fullName: string;
}

async function newCustomer(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string, tag: string): Promise<Customer> {
  const api = await playwright.request.newContext({ baseURL });
  const email = uniqueEmail(tag);
  const password = randomPassword();
  const fullName = `Khách ${tag} ${Date.now() % 100000}`;
  const response = await api.post("/api/auth/register", { data: { fullName, email, password } });
  expect(response.status(), await response.text()).toBe(201);
  const me = (await (await api.get("/api/auth/me")).json()) as { user: { id: string } | null };
  expect(me.user, "vừa đăng ký xong phải đang đăng nhập").toBeTruthy();
  return { api, id: me.user!.id, email, password, fullName };
}

async function login(api: APIRequestContext, email: string, password: string) {
  return api.post("/api/auth/login", { data: { email, password } });
}

/** Mở trang Khách hàng, tìm đúng một khách theo email và trả về dòng của khách đó */
async function openCustomerRow(page: Page, email: string) {
  await page.goto("/admin/customers");
  await page.getByLabel(/Tìm khách hàng/).fill(email);
  await page.getByRole("button", { name: "Tìm", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: email });
  await expect(row).toHaveCount(1);
  return row;
}

test.describe("Quản lý khách hàng — khu quản trị", () => {
  test.beforeEach(async ({ page }) => {
    await loginAdmin(page);
  });

  test("sửa thông tin qua hộp thoại: họ tên, SĐT, địa chỉ mặc định; email trùng tài khoản khác bị từ chối", async ({ page, playwright, baseURL }) => {
    const a = await newCustomer(playwright, baseURL!, "sua-a");
    const b = await newCustomer(playwright, baseURL!, "sua-b");

    const row = await openCustomerRow(page, a.email);
    await row.getByRole("button", { name: `Sửa thông tin ${a.fullName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Sửa thông tin khách hàng" });
    await expect(dialog.getByLabel(/^Họ tên/)).toHaveValue(a.fullName);
    expect(await seriousViolations(page)).toEqual([]);

    const newName = `${a.fullName} Đã Sửa`;
    await dialog.getByLabel(/^Họ tên/).fill(newName);
    await dialog.getByLabel("Số điện thoại").fill("0912 345 678");
    await dialog.getByLabel("Tỉnh/Thành").fill("Hà Nội");
    await dialog.getByLabel("Quận/Huyện").fill("Cầu Giấy");
    await dialog.getByLabel("Phường/Xã").fill("Dịch Vọng");
    await dialog.getByLabel("Số nhà, tên đường").fill("Số 1, đường Xuân Thuỷ");
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: a.email })).toContainText(newName);

    const detail = (await (await page.request.get(`/api/admin/customers/${a.id}`)).json()) as {
      fullName: string;
      phone?: string;
      defaultAddress?: { province: string; streetAddress: string; recipientName: string };
    };
    expect(detail.fullName).toBe(newName);
    expect(detail.phone).toBe("0912345678");
    expect(detail.defaultAddress).toMatchObject({ province: "Hà Nội", streetAddress: "Số 1, đường Xuân Thuỷ", recipientName: newName });

    // Đổi sang email của khách B: máy chủ từ chối, hộp thoại giữ nguyên và báo lỗi
    await page.getByRole("row").filter({ hasText: a.email }).getByRole("button", { name: `Sửa thông tin ${newName}` }).click();
    await dialog.getByLabel(/^Email/).fill(b.email);
    await dialog.getByRole("button", { name: "Lưu thay đổi" }).click();
    await expect(dialog.getByRole("alert")).toContainText("Email này đã được tài khoản khác sử dụng");
    await dialog.getByRole("button", { name: "Huỷ" }).click();
    await expect(dialog).toBeHidden();

    await a.api.dispose();
    await b.api.dispose();
  });

  test("khoá kèm lý do: khách bị đăng xuất ngay, không đăng nhập lại được; mở khoá thì đăng nhập lại được", async ({ page, playwright, baseURL }) => {
    const c = await newCustomer(playwright, baseURL!, "khoa");
    expect((await c.api.get("/api/orders")).status(), "trước khi khoá: phiên khách dùng được").toBe(200);

    const row = await openCustomerRow(page, c.email);
    await row.getByRole("button", { name: `Khoá tài khoản ${c.fullName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Khoá tài khoản" });
    await expect(dialog.getByRole("button", { name: "Khoá tài khoản" }), "chưa nhập lý do thì chưa khoá được").toBeDisabled();
    expect(await seriousViolations(page)).toEqual([]);
    await dialog.getByLabel(/^Lý do khoá/).fill("Đặt nhiều đơn COD rồi không nhận hàng");
    await dialog.getByRole("button", { name: "Khoá tài khoản" }).click();
    await expect(dialog).toBeHidden();
    const lockedRow = page.getByRole("row").filter({ hasText: c.email });
    await expect(lockedRow).toContainText("Đang khoá");
    await expect(lockedRow).toContainText("Đặt nhiều đơn COD rồi không nhận hàng");

    // Access token khách đang cầm (còn hạn ~15 phút) bị từ chối NGAY, làm mới phiên cũng không được
    expect((await c.api.get("/api/orders")).status(), "phiên cũ bị thu hồi ngay").toBe(401);
    expect((await c.api.post("/api/auth/refresh")).status(), "refresh token đã bị xoá").toBe(401);
    expect((await login(c.api, c.email, c.password)).status(), "đăng nhập lại khi đang khoá").toBe(403);

    await lockedRow.getByRole("button", { name: `Mở khoá tài khoản ${c.fullName}` }).click();
    const unlock = page.getByRole("dialog", { name: "Mở khoá tài khoản" });
    await expect(unlock).toContainText("Đặt nhiều đơn COD rồi không nhận hàng");
    await unlock.getByRole("button", { name: "Mở khoá" }).click();
    await expect(unlock).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: c.email })).toContainText("Hoạt động");

    expect((await login(c.api, c.email, c.password)).ok(), "mở khoá xong đăng nhập lại được").toBe(true);
    expect((await c.api.get("/api/orders")).status(), "phiên mới sau khi mở khoá dùng được").toBe(200);
    await c.api.dispose();
  });

  test("cấp lại mật khẩu ngẫu nhiên: khách bị đăng xuất, mật khẩu cũ hết hiệu lực, mật khẩu mới đăng nhập được", async ({ page, playwright, baseURL }) => {
    const d = await newCustomer(playwright, baseURL!, "matkhau");

    const row = await openCustomerRow(page, d.email);
    await row.getByRole("button", { name: `Cấp lại mật khẩu cho ${d.fullName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Cấp lại mật khẩu" });
    await expect(dialog.getByRole("radio", { name: /Tạo mật khẩu ngẫu nhiên/ })).toBeChecked();
    await dialog.getByRole("button", { name: "Tạo mật khẩu mới" }).click();
    const done = page.getByRole("dialog", { name: "Đã cấp lại mật khẩu" });
    const generated = (await done.getByTestId("generated-password").textContent())?.trim() ?? "";
    expect(generated).toMatch(/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z0-9]{12}$/);
    expect(await seriousViolations(page)).toEqual([]);
    await done.getByRole("button", { name: "Xong" }).click();

    expect((await d.api.get("/api/orders")).status(), "phiên cũ bị đăng xuất").toBe(401);
    expect((await login(d.api, d.email, d.password)).status(), "mật khẩu cũ").toBe(401);
    expect((await login(d.api, d.email, generated)).ok(), "mật khẩu mới").toBe(true);

    // Tự đặt mật khẩu yếu qua API: bị từ chối theo cùng luật với đăng ký
    const weak = await page.request.post(`/api/admin/customers/${d.id}/reset-password`, { data: { password: "abcdefgh" } });
    expect(weak.status()).toBe(400);
    await d.api.dispose();
  });

  test("xoá tài khoản: chặn khi còn đơn đang xử lý; xoá được khi đơn đã huỷ, đơn cũ vẫn còn", async ({ page, playwright, baseURL }) => {
    const e = await newCustomer(playwright, baseURL!, "xoa");
    const orderCode = await placeCodOrderViaApi(e.api, MOUSE.slug);

    let row = await openCustomerRow(page, e.email);
    await row.getByRole("button", { name: `Xoá tài khoản ${e.fullName}` }).click();
    const dialog = page.getByRole("dialog", { name: "Xoá tài khoản khách hàng?" });
    await expect(dialog.getByRole("button", { name: "Xoá vĩnh viễn" }), "chưa xác nhận đã hiểu thì chưa xoá được").toBeDisabled();
    expect(await seriousViolations(page)).toEqual([]);
    await dialog.getByLabel("Tôi hiểu và muốn xoá tài khoản này").check();
    await dialog.getByRole("button", { name: "Xoá vĩnh viễn" }).click();
    await expect(dialog.getByRole("alert")).toContainText("còn 1 đơn đang xử lý");
    await dialog.getByRole("button", { name: "Huỷ" }).click();

    const cancelled = await page.request.post(`/api/admin/orders/${encodeURIComponent(orderCode)}/cancel`, { data: { reason: "Kiểm thử xoá tài khoản" } });
    expect(cancelled.ok(), await cancelled.text()).toBe(true);

    row = await openCustomerRow(page, e.email);
    await row.getByRole("button", { name: `Xoá tài khoản ${e.fullName}` }).click();
    await dialog.getByLabel("Tôi hiểu và muốn xoá tài khoản này").check();
    await dialog.getByRole("button", { name: "Xoá vĩnh viễn" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("row").filter({ hasText: e.email })).toHaveCount(0);

    expect((await page.request.get(`/api/admin/customers/${e.id}`)).status(), "hồ sơ khách đã xoá").toBe(404);
    expect((await page.request.get(`/api/admin/orders/${encodeURIComponent(orderCode)}`)).ok(), "đơn cũ vẫn giữ để đối soát").toBe(true);
    expect((await e.api.get("/api/orders")).status(), "phiên của khách đã xoá bị thu hồi").toBe(401);
    expect((await login(e.api, e.email, e.password)).ok(), "không đăng nhập được nữa").toBe(false);
    await e.api.dispose();
  });
});
