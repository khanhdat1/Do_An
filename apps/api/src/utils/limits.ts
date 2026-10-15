// Số lượng mỗi dòng trong giỏ / một lần đặt không có trần cố định: chặn theo tồn kho khả dụng
// đọc từ DB (`availableQuantity` trong mappers/cart.mapper.ts).

/** Số sản phẩm khác nhau tối đa trong một giỏ — chặn giỏ vãng lai bị nhồi rác */
export const MAX_CART_LINES = 50;

/** Số địa chỉ giao hàng tối đa lưu được trong sổ địa chỉ của một tài khoản */
export const MAX_ADDRESSES = 10;
