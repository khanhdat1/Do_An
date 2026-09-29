import { expect, test } from "@playwright/test";
import { addToCart, loginAdmin, MOUSE, registerCustomerViaUi, TEST_ADDRESS } from "./helpers";

/**
 * Trọn vòng đời một đơn hàng, đúng như người dùng thật thao tác trên giao diện — hai trình duyệt tách biệt
 * (khách và quản trị, cookie riêng):
 * đăng ký → đặt hàng COD kèm mã giảm giá → quản trị xác nhận/đóng gói/giao (có mã vận đơn)/đã giao →
 * khách thấy tiến trình → khách đánh giá (chỉ được sau khi nhận hàng) → quản trị duyệt → đánh giá hiện công khai.
 */
test("vòng đời đơn hàng: đặt hàng → quản trị xử lý → giao hàng → đánh giá → duyệt", async ({ browser }) => {
  test.setTimeout(180_000);

  const customerContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const customer = await customerContext.newPage();
  const admin = await adminContext.newPage();

  const trackingNumber = `E2E${Date.now()}`;
  const reviewTitle = `Chuột nhẹ, bấm êm (e2e ${Date.now()})`;
  let orderCode = "";

  await test.step("khách đăng ký tài khoản mới", async () => {
    await registerCustomerViaUi(customer, "Khách Kiểm Thử");
    await expect(customer.getByRole("heading", { level: 1, name: /Xin chào/ })).toBeVisible();
  });

  await test.step("chưa nhận hàng thì chưa được đánh giá sản phẩm", async () => {
    await customer.goto(`/san-pham/${MOUSE.slug}`);
    await expect(customer.getByText("Bạn đánh giá được sau khi đã nhận hàng")).toBeVisible();
    await expect(customer.getByRole("button", { name: "Gửi đánh giá" })).toHaveCount(0);
  });

  await test.step("thêm vào giỏ, nhập địa chỉ, áp mã WELCOME10 rồi đặt hàng COD", async () => {
    await addToCart(customer, MOUSE.slug);
    await customer.goto("/thanh-toan");

    await customer.getByLabel(/^Tên người nhận/).fill(TEST_ADDRESS.recipientName);
    await customer.getByLabel(/^Số điện thoại/).fill(TEST_ADDRESS.phone);
    await customer.getByLabel(/^Tỉnh\/Thành phố/).fill(TEST_ADDRESS.province);
    await customer.getByLabel(/^Quận\/Huyện/).fill(TEST_ADDRESS.district);
    await customer.getByLabel(/^Phường\/Xã/).fill(TEST_ADDRESS.ward);
    await customer.getByLabel(/^Số nhà, tên đường/).fill(TEST_ADDRESS.streetAddress);
    await customer.getByRole("button", { name: "Lưu địa chỉ" }).click();
    await expect(customer.getByText(TEST_ADDRESS.streetAddress).first()).toBeVisible();

    await customer.getByPlaceholder("Nhập mã giảm giá").fill("WELCOME10");
    await customer.getByRole("button", { name: "Áp dụng" }).click();
    // 10% của 3.490.000đ = 349.000đ, bị chặn ở mức giảm tối đa 300.000đ; miễn phí vận chuyển → 3.190.000đ
    await expect(customer.getByText("-300.000đ").first()).toBeVisible();

    await customer.getByRole("button", { name: "Đặt hàng", exact: true }).click();
    await customer.waitForURL(/\/don-hang\/[^/?]+$/);
    orderCode = decodeURIComponent(new URL(customer.url()).pathname.split("/").pop() ?? "");
    expect(orderCode).not.toBe("");

    await expect(customer.getByRole("list", { name: "Tiến trình đơn hàng: Chờ xác nhận" })).toBeVisible();
    await expect(customer.getByText("3.190.000đ").first()).toBeVisible();
  });

  await test.step("quản trị: xác nhận → đóng gói → giao hàng (lưu mã vận đơn) → đã giao", async () => {
    await loginAdmin(admin);
    await admin.goto(`/admin/orders/${encodeURIComponent(orderCode)}`);
    await expect(admin.getByText(orderCode).first()).toBeVisible();

    await admin.getByRole("button", { name: "Xác nhận đơn hàng" }).click();
    await admin.getByRole("button", { name: "Bắt đầu đóng gói" }).click();
    await admin.getByRole("button", { name: "Bắt đầu giao hàng" }).click();
    await expect(admin.getByRole("button", { name: "Đánh dấu đã giao thành công" })).toBeVisible();

    await admin.getByPlaceholder("Chưa có mã vận đơn").fill(trackingNumber);
    await admin.getByRole("button", { name: "Lưu", exact: true }).click();
    await expect(admin.getByText("Đã lưu mã vận đơn")).toBeVisible();

    await admin.getByRole("button", { name: "Đánh dấu đã giao thành công" }).click();
    await expect(admin.getByRole("button", { name: "Đánh dấu đã giao thành công" })).toHaveCount(0);
  });

  await test.step("khách thấy đơn đã giao kèm mã vận đơn, trang Tài khoản cập nhật số đơn", async () => {
    await customer.goto(`/don-hang/${encodeURIComponent(orderCode)}`);
    await expect(customer.getByRole("list", { name: "Tiến trình đơn hàng: Đã giao hàng" })).toBeVisible();
    await expect(customer.getByText(trackingNumber)).toBeVisible();

    await customer.goto("/tai-khoan/don-hang");
    await customer.getByRole("tab", { name: /Đã giao/ }).click();
    await expect(customer.getByText(orderCode).first()).toBeVisible();
  });

  await test.step("khách viết đánh giá — chưa hiện công khai khi chưa được duyệt", async () => {
    await customer.goto(`/san-pham/${MOUSE.slug}`);
    await customer.getByRole("radio", { name: "5 sao" }).click();
    await customer.getByPlaceholder("Tiêu đề (không bắt buộc)").fill(reviewTitle);
    await customer
      .getByPlaceholder("Chia sẻ cảm nhận của bạn về sản phẩm (không bắt buộc)")
      .fill("Cầm nhẹ tay, pin trâu, kết nối không dây ổn định.");
    await customer.getByRole("button", { name: "Gửi đánh giá" }).click();
    await expect(customer.getByText("Bạn đã đánh giá sản phẩm này. Cảm ơn bạn!")).toBeVisible();

    await customer.reload();
    await expect(customer.getByText("Bạn đã đánh giá sản phẩm này. Cảm ơn bạn!")).toBeVisible();
    await expect(customer.getByText(reviewTitle)).toHaveCount(0);
  });

  await test.step("quản trị duyệt → đánh giá hiện công khai cho mọi người", async () => {
    await admin.goto("/admin/reviews");
    const row = admin.locator("div.p-3").filter({ hasText: reviewTitle });
    await row.getByRole("button", { name: "Duyệt" }).click();
    await expect(admin.getByText("Đã duyệt đánh giá")).toBeVisible();

    const guestContext = await browser.newContext();
    const guest = await guestContext.newPage();
    await guest.goto(`/san-pham/${MOUSE.slug}`);
    await expect(guest.getByText(reviewTitle)).toBeVisible();
    await guestContext.close();
  });

  await customerContext.close();
  await adminContext.close();
});
