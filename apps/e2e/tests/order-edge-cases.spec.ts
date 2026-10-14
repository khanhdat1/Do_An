import { expect, request as playwrightRequest, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import { API_URL, WEB_URL } from "../e2e-env";
import { randomPassword, TEST_ADDRESS, uniqueEmail } from "./helpers";

/**
 * Các ca kiểm thử bổ sung cho đơn hàng (Bảng 5.9 của báo cáo, TC16–TC20) — gọi thẳng API, không qua giao diện.
 * Mỗi khách/quản trị là một APIRequestContext riêng (cookie phiên riêng). Gọi thẳng tới API_URL (không qua proxy
 * của web) nên chạy được cả với cấu hình chính lẫn `playwright.api-only.config.ts`; header Origin là của web kiểm
 * thử vì originGuard chỉ cho phép Origin nằm trong CORS_ORIGIN.
 *
 * Mỗi ca in một dòng `[KET-QUA] {...}` chứa số liệu thật (mã HTTP, tồn kho, sổ kho, lượt dùng mã, lịch sử trạng
 * thái, paymentStatus) TRƯỚC khi so kỳ vọng — ca không đạt vẫn để lại đủ bằng chứng. Kỳ vọng dùng `expect.soft`
 * để một điều kiện sai không che mất các điều kiện còn lại.
 */

const SEED_ADMIN = { email: "admin@pczone.vn", password: "admin123" };
/** Sản phẩm mẫu trong seed.ts, không test nào khác dùng: TC16 riêng một sản phẩm, TC17–TC20 dùng chung sản phẩm thứ hai */
const RACE_PRODUCT_SLUG = "ssd-samsung-990-pro-2tb";
const FLOW_PRODUCT_SLUG = "ram-corsair-vengeance-rgb-ddr5-32gb";
const VOUCHER_CODE = "WELCOME10";
const RACE_CUSTOMERS = Number(process.env.E2E_TC16_CUSTOMERS ?? 10);

interface InventoryRow {
  type: string;
  quantityChange: number;
  quantityAfter: number;
  orderCode?: string;
  note?: string;
  createdAt: string;
}
interface StatusEvent {
  status: string;
  note?: string;
  changedByName?: string;
  createdAt: string;
}
interface AdminOrder {
  orderCode: string;
  status: string;
  paymentStatus: string;
  discountAmount: number;
  voucherCode?: string;
  statusHistory: StatusEvent[];
}

const newContext = () => playwrightRequest.newContext({ baseURL: API_URL, extraHTTPHeaders: { Origin: WEB_URL } });

function report(code: string, data: Record<string, unknown>): void {
  console.log(`[KET-QUA] ${JSON.stringify({ ca: code, ...data })}`);
}

async function bodyOf(response: APIResponse): Promise<unknown> {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function loginAdmin(): Promise<APIRequestContext> {
  const admin = await newContext();
  const response = await admin.post("/api/admin/auth/login", { data: SEED_ADMIN });
  expect(response.ok(), await response.text()).toBe(true);
  return admin;
}

async function productId(api: APIRequestContext, slug: string): Promise<string> {
  const response = await api.get(`/api/products/${slug}`);
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { id: string }).id;
}

/** Đưa tồn kho về đúng số cho trước bằng phiếu ADJUST (kiểm kê) của trang quản trị */
async function setStock(admin: APIRequestContext, id: string, newQuantity: number): Promise<void> {
  const response = await admin.post(`/api/admin/products/${id}/inventory`, {
    data: { type: "ADJUST", newQuantity, note: `e2e: đặt tồn kho = ${newQuantity}` },
  });
  expect(response.ok(), await response.text()).toBe(true);
}

async function stockOf(admin: APIRequestContext, id: string): Promise<number> {
  const response = await admin.get(`/api/admin/products/${id}`);
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { inventoryQuantity: number }).inventoryQuantity;
}

/** Sổ kho của sản phẩm (mới nhất trước, tối đa 60 dòng) */
async function inventoryRows(admin: APIRequestContext, id: string): Promise<InventoryRow[]> {
  const response = await admin.get(`/api/admin/products/${id}/inventory?pageSize=60`);
  expect(response.ok(), await response.text()).toBe(true);
  return ((await response.json()) as { items: InventoryRow[] }).items;
}

async function voucherUsage(admin: APIRequestContext, code: string): Promise<number> {
  const response = await admin.get(`/api/admin/vouchers?search=${code}&pageSize=50`);
  expect(response.ok(), await response.text()).toBe(true);
  const items = ((await response.json()) as { items: { code: string; usageCount: number }[] }).items;
  const voucher = items.find((item) => item.code === code);
  expect(voucher, `không thấy mã ${code}`).toBeTruthy();
  return voucher!.usageCount;
}

async function adminOrder(admin: APIRequestContext, orderCode: string): Promise<AdminOrder> {
  const response = await admin.get(`/api/admin/orders/${encodeURIComponent(orderCode)}`);
  expect(response.ok(), await response.text()).toBe(true);
  return (await response.json()) as AdminOrder;
}

/** Khách mới: đăng ký (cookie phiên nằm trong context), lưu một địa chỉ giao hàng, trả kèm id địa chỉ */
async function newCustomer(tag: string): Promise<{ api: APIRequestContext; addressId: string }> {
  const api = await newContext();
  const register = await api.post("/api/auth/register", {
    data: { fullName: `Khách e2e ${tag}`, email: uniqueEmail(tag), password: randomPassword() },
  });
  expect(register.status(), await register.text()).toBe(201);

  const address = await api.post("/api/addresses", { data: TEST_ADDRESS });
  expect(address.status(), await address.text()).toBe(201);
  const body = (await address.json()) as { id?: string; address?: { id: string } };
  return { api, addressId: (body.address?.id ?? body.id)! };
}

async function addToCart(api: APIRequestContext, id: string, quantity = 1): Promise<void> {
  const response = await api.post("/api/cart/items", { data: { productId: id, quantity } });
  expect(response.ok(), await response.text()).toBe(true);
}

function placeOrder(api: APIRequestContext, addressId: string, voucherCode?: string): Promise<APIResponse> {
  return api.post("/api/orders", { data: { addressId, paymentMethod: "COD", ...(voucherCode ? { voucherCode } : {}) } });
}

async function placeOrderOk(api: APIRequestContext, addressId: string, voucherCode?: string): Promise<string> {
  const response = await placeOrder(api, addressId, voucherCode);
  expect(response.status(), await response.text()).toBe(201);
  return ((await response.json()) as { order: { orderCode: string } }).order.orderCode;
}

/** Chuyển tiến từng bước (PENDING → CONFIRMED → PACKING → SHIPPING) qua PATCH .../status */
async function advance(admin: APIRequestContext, orderCode: string, statuses: string[]): Promise<void> {
  for (const status of statuses) {
    const response = await admin.patch(`/api/admin/orders/${encodeURIComponent(orderCode)}/status`, { data: { status } });
    expect(response.ok(), await response.text()).toBe(true);
  }
}

const rowsOfOrder = (rows: InventoryRow[], orderCode: string) =>
  rows
    .filter((row) => row.orderCode === orderCode)
    .map(({ type, quantityChange, quantityAfter, note }) => ({ type, quantityChange, quantityAfter, note }));

// KHÔNG dùng mode "serial": các ca độc lập (mỗi ca tự đặt tồn kho, tự tạo khách) — một ca không đạt không được
// làm các ca sau bị bỏ qua. Cấu hình chạy 1 worker nên các ca vẫn chạy lần lượt, không giẫm dữ liệu của nhau.

test(`TC16 - ${RACE_CUSTOMERS} khách đặt cùng lúc sản phẩm chỉ còn 1`, async () => {
  const admin = await loginAdmin();
  const id = await productId(admin, RACE_PRODUCT_SLUG);

  const customers = [];
  for (let i = 0; i < RACE_CUSTOMERS; i++) customers.push(await newCustomer(`tc16-${i}`));

  await setStock(admin, id, 1);
  const stockBefore = await stockOf(admin, id);
  for (const customer of customers) await addToCart(customer.api, id);

  // Mốc thời gian để chỉ đếm dòng sổ kho của lượt này (sổ kho trả createdAt dạng ISO)
  const startedAt = new Date().toISOString();
  const responses = await Promise.all(customers.map((customer) => placeOrder(customer.api, customer.addressId)));
  const results = await Promise.all(
    responses.map(async (response) => ({ status: response.status(), body: await bodyOf(response) })),
  );

  const created = results.filter((result) => result.status === 201);
  const createdCodes = created.map((result) => (result.body as { order: { orderCode: string } }).order.orderCode);
  const stockAfter = await stockOf(admin, id);
  const exportRows = (await inventoryRows(admin, id)).filter((row) => row.type === "EXPORT" && row.createdAt >= startedAt);

  const statusCount: Record<string, number> = {};
  for (const result of results) statusCount[result.status] = (statusCount[result.status] ?? 0) + 1;
  report("TC16", {
    soKhach: RACE_CUSTOMERS,
    maHttp: statusCount,
    donTaoDuoc: createdCodes,
    thongBaoLoi: [...new Set(results.filter((r) => r.status !== 201).map((r) => (r.body as { message?: string }).message ?? r.body))],
    tonKhoTruoc: stockBefore,
    tonKhoSau: stockAfter,
    soKhoExportLuotNay: exportRows.map(({ type, quantityChange, quantityAfter, orderCode }) => ({ type, quantityChange, quantityAfter, orderCode })),
  });

  expect.soft(created, "đúng 1 đơn được tạo").toHaveLength(1);
  expect.soft(statusCount[409] ?? 0, `${RACE_CUSTOMERS - 1} yêu cầu nhận 409`).toBe(RACE_CUSTOMERS - 1);
  expect.soft(stockAfter, "tồn kho cuối").toBe(0);
  expect.soft(exportRows, "đúng 1 dòng EXPORT trong lượt này").toHaveLength(1);
  if (exportRows.length === 1 && createdCodes.length === 1) expect.soft(exportRows[0].orderCode).toBe(createdCodes[0]);
});

test("TC17 - khách tự huỷ đơn Chờ xác nhận có mã giảm giá: hoàn kho, trả lượt mã", async () => {
  const admin = await loginAdmin();
  const id = await productId(admin, FLOW_PRODUCT_SLUG);
  await setStock(admin, id, 5);
  const customer = await newCustomer("tc17");

  const stockBefore = await stockOf(admin, id);
  const usageBefore = await voucherUsage(admin, VOUCHER_CODE);
  await addToCart(customer.api, id, 2);
  const orderCode = await placeOrderOk(customer.api, customer.addressId, VOUCHER_CODE);
  const placed = await adminOrder(admin, orderCode);
  const stockAfterOrder = await stockOf(admin, id);
  const usageAfterOrder = await voucherUsage(admin, VOUCHER_CODE);

  const cancel = await customer.api.post(`/api/orders/${encodeURIComponent(orderCode)}/cancel`, { data: {} });
  const cancelStatus = cancel.status();
  const cancelBody = await bodyOf(cancel);
  const after = await adminOrder(admin, orderCode);
  const stockAfterCancel = await stockOf(admin, id);
  const usageAfterCancel = await voucherUsage(admin, VOUCHER_CODE);
  const rows = rowsOfOrder(await inventoryRows(admin, id), orderCode);

  report("TC17", {
    orderCode,
    trangThaiLucDat: placed.status,
    maGiamGia: placed.voucherCode,
    giamGia: placed.discountAmount,
    maHttpHuy: cancelStatus,
    loiHuy: cancelStatus === 200 ? undefined : cancelBody,
    trangThaiSauHuy: after.status,
    paymentStatusSauHuy: after.paymentStatus,
    tonKho: { truocDat: stockBefore, sauDat: stockAfterOrder, sauHuy: stockAfterCancel },
    usageCount: { truocDat: usageBefore, sauDat: usageAfterOrder, sauHuy: usageAfterCancel },
    soKhoCuaDon: rows,
    lichSuCuoi: after.statusHistory.at(-1),
  });

  expect.soft(placed.voucherCode, "đơn có dùng mã").toBe(VOUCHER_CODE);
  expect.soft(placed.discountAmount, "đơn được giảm giá").toBeGreaterThan(0);
  expect.soft(usageAfterOrder, "đặt đơn tăng 1 lượt dùng mã").toBe(usageBefore + 1);
  expect.soft(cancelStatus, "khách huỷ thành công").toBe(200);
  expect.soft(after.status, "đơn chuyển Đã huỷ").toBe("CANCELLED");
  expect.soft(stockAfterCancel, "tồn kho hoàn lại").toBe(stockBefore);
  expect.soft(usageAfterCancel, "lượt dùng mã được trả").toBe(usageBefore);
  expect.soft(rows.filter((row) => row.quantityChange > 0), "có dòng sổ kho hoàn (+2)").toEqual([
    expect.objectContaining({ quantityChange: 2 }),
  ]);
});

test("TC18 - nhân viên huỷ đơn đang đóng gói, có lý do: hoàn kho, ghi lịch sử, không tự hoàn tiền", async () => {
  const admin = await loginAdmin();
  const id = await productId(admin, FLOW_PRODUCT_SLUG);
  await setStock(admin, id, 5);
  const customer = await newCustomer("tc18");
  const reason = `TC18 e2e: khách gọi điện đổi ý (${Date.now()})`;

  const stockBefore = await stockOf(admin, id);
  await addToCart(customer.api, id);
  const orderCode = await placeOrderOk(customer.api, customer.addressId);
  await advance(admin, orderCode, ["CONFIRMED", "PACKING"]);
  const packing = await adminOrder(admin, orderCode);
  const stockWhilePacking = await stockOf(admin, id);

  const cancel = await admin.post(`/api/admin/orders/${encodeURIComponent(orderCode)}/cancel`, { data: { reason } });
  const cancelStatus = cancel.status();
  const cancelBody = await bodyOf(cancel);
  const after = await adminOrder(admin, orderCode);
  const stockAfter = await stockOf(admin, id);
  const rows = rowsOfOrder(await inventoryRows(admin, id), orderCode);
  const lastEvent = after.statusHistory.at(-1);

  report("TC18", {
    orderCode,
    trangThaiTruocHuy: packing.status,
    maHttpHuy: cancelStatus,
    loiHuy: cancelStatus === 200 ? undefined : cancelBody,
    trangThaiSauHuy: after.status,
    paymentStatus: { truocHuy: packing.paymentStatus, sauHuy: after.paymentStatus },
    tonKho: { truocDat: stockBefore, dangDongGoi: stockWhilePacking, sauHuy: stockAfter },
    soKhoCuaDon: rows,
    lichSuCuoi: lastEvent,
  });

  expect.soft(packing.status, "đơn đang đóng gói trước khi huỷ").toBe("PACKING");
  expect.soft(cancelStatus, "nhân viên huỷ thành công").toBe(200);
  expect.soft(after.status).toBe("CANCELLED");
  expect.soft(stockAfter, "hoàn kho").toBe(stockBefore);
  expect.soft(rows.filter((row) => row.quantityChange > 0), "có dòng sổ kho hoàn (+1)").toHaveLength(1);
  expect.soft(lastEvent?.status).toBe("CANCELLED");
  expect.soft(lastEvent?.note, "lịch sử ghi lý do").toBe(reason);
  expect.soft(lastEvent?.changedByName, "lịch sử ghi người thực hiện").toBeTruthy();
  expect.soft(after.paymentStatus, "không tự hoàn tiền").toBe(packing.paymentStatus);
});

test("TC19 - hoàn trả đơn đang giao: Đã hoàn trả, hoàn kho loại RETURN", async () => {
  const admin = await loginAdmin();
  const id = await productId(admin, FLOW_PRODUCT_SLUG);
  await setStock(admin, id, 5);
  const customer = await newCustomer("tc19");
  const reason = "TC19 e2e: giao không thành công, hàng về kho";

  const stockBefore = await stockOf(admin, id);
  await addToCart(customer.api, id);
  const orderCode = await placeOrderOk(customer.api, customer.addressId);
  await advance(admin, orderCode, ["CONFIRMED", "PACKING", "SHIPPING"]);
  const shipping = await adminOrder(admin, orderCode);
  const stockWhileShipping = await stockOf(admin, id);

  const response = await admin.post(`/api/admin/orders/${encodeURIComponent(orderCode)}/return`, { data: { reason } });
  const returnStatus = response.status();
  const returnBody = await bodyOf(response);
  const after = await adminOrder(admin, orderCode);
  const stockAfter = await stockOf(admin, id);
  const rows = rowsOfOrder(await inventoryRows(admin, id), orderCode);

  report("TC19", {
    orderCode,
    trangThaiTruoc: shipping.status,
    maHttpHoanTra: returnStatus,
    loi: returnStatus === 200 ? undefined : returnBody,
    trangThaiSau: after.status,
    paymentStatus: { truoc: shipping.paymentStatus, sau: after.paymentStatus },
    tonKho: { truocDat: stockBefore, dangGiao: stockWhileShipping, sauHoanTra: stockAfter },
    soKhoCuaDon: rows,
    lichSuCuoi: after.statusHistory.at(-1),
  });

  expect.soft(shipping.status, "đơn đang giao trước khi hoàn trả").toBe("SHIPPING");
  expect.soft(returnStatus, "hoàn trả thành công").toBe(200);
  expect.soft(after.status, "trạng thái Đã hoàn trả").toBe("RETURNED");
  expect.soft(stockAfter, "hoàn kho").toBe(stockBefore);
  expect.soft(rows.filter((row) => row.type === "RETURN"), "đúng 1 dòng sổ kho RETURN +1").toEqual([
    expect.objectContaining({ type: "RETURN", quantityChange: 1 }),
  ]);
});

test("TC20 - ghi nhận hoàn tiền cho đơn chưa thu tiền bị từ chối (409)", async () => {
  const admin = await loginAdmin();
  const id = await productId(admin, FLOW_PRODUCT_SLUG);
  await setStock(admin, id, 5);
  const customer = await newCustomer("tc20");

  await addToCart(customer.api, id);
  const orderCode = await placeOrderOk(customer.api, customer.addressId);
  const before = await adminOrder(admin, orderCode);

  const response = await admin.post(`/api/admin/orders/${encodeURIComponent(orderCode)}/mark-refunded`, { data: {} });
  const refundStatus = response.status();
  const refundBody = await bodyOf(response);
  const after = await adminOrder(admin, orderCode);

  report("TC20", {
    orderCode,
    trangThaiDon: before.status,
    maHttp: refundStatus,
    phanHoi: refundBody,
    paymentStatus: { truoc: before.paymentStatus, sau: after.paymentStatus },
  });

  expect.soft(before.paymentStatus, "đơn chưa thu tiền").toBe("PENDING");
  expect.soft(refundStatus, "bị từ chối 409").toBe(409);
  expect.soft(after.paymentStatus, "paymentStatus không đổi").toBe(before.paymentStatus);
});
