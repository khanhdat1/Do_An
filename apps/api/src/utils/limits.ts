/**
 * Trần số lượng của một sản phẩm trong giỏ / một đơn, đi kèm tồn kho khả dụng đọc từ DB
 * (`availableQuantity` trong mappers/cart.mapper.ts): mua tối đa min(tồn kho, trần này). Chặn một
 * đơn chưa thanh toán (vd COD) giữ hết hàng của cả một món.
 */
export const MAX_QUANTITY_PER_LINE = 50;

/** Số sản phẩm khác nhau tối đa trong một giỏ — chặn giỏ vãng lai bị nhồi rác */
export const MAX_CART_LINES = 50;

/** Số địa chỉ giao hàng tối đa lưu được trong sổ địa chỉ của một tài khoản */
export const MAX_ADDRESSES = 10;
