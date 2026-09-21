/**
 * Gợi ý tìm kiếm cố định, hiện khi ô tìm kiếm còn trống và ở trang tìm kiếm khi chưa có kết quả.
 * Mỗi câu ở đây phải ra kết quả với dữ liệu demo hiện có.
 */
export const popularSearches = [
  "Laptop gaming",
  "RTX 5070",
  "Bàn phím cơ",
  "Chuột không dây",
  "Màn hình 240Hz",
  "Tai nghe gaming",
  "Ghế công thái học",
  "SSD 1TB",
];

/** Ví dụ câu tìm kiếm thông minh (hiểu giá, không dấu, từ đồng nghĩa) ở trang tìm kiếm trống */
export const searchTips = [
  { query: "laptop gaming dưới 30 triệu", note: "Hiểu cả mức giá trong câu" },
  { query: "ban phim co", note: "Gõ không dấu vẫn ra đúng sản phẩm" },
  { query: "mouse logitech", note: "Hiểu từ tiếng Anh: mouse, keyboard, headphone, monitor..." },
  { query: "rtx5070ti", note: "Mã hàng viết liền hay tách rời đều khớp" },
];
