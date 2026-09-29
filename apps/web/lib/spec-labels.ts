/**
 * Nhãn thông số trùng nghĩa giữa các nguồn dữ liệu — crawler ghi theo mẫu từng danh mục ("Bộ vi xử lý (CPU)" cho PC,
 * "CPU" cho laptop), 14 sản phẩm mẫu viết tay trong seed ("CPU", "RAM"), sản phẩm nhập tay ở trang quản trị. Bảng so
 * sánh gộp chúng về MỘT dòng thay vì hai dòng "CPU" / "Bộ vi xử lý (CPU)" mỗi dòng chỉ có giá trị ở vài cột.
 *
 * So khớp NGUYÊN VĂN (bỏ khoảng trắng thừa, không phân biệt hoa thường), không đoán theo chữ gần giống: "Bộ nhớ"
 * (VRAM của card đồ họa) khác "Bộ nhớ RAM", "CPU hỗ trợ" (của mainboard) khác "CPU". Danh sách lập từ lượt quét
 * toàn bộ nhãn thông số đang có trong DB — thêm cặp mới khi dữ liệu có cách gọi mới.
 */
const SYNONYMS: Record<string, string[]> = {
  "Bộ vi xử lý (CPU)": ["CPU", "Bộ vi xử lý", "Vi xử lý"],
  "Bộ nhớ RAM": ["RAM"],
  "Card đồ họa (VGA)": ["Card đồ họa", "Card đồ hoạ", "Card đồ hoạ (VGA)", "VGA", "Card màn hình"],
  "Ổ cứng": ["Ổ cứng SSD", "SSD", "Lưu trữ"],
  "Trọng lượng": ["Khối lượng"],
  "Kết nối không dây": ["Không dây"],
  "Bảo hành": ["Thời gian bảo hành"],
  "Nhân CUDA / Stream Processor": ["Nhân CUDA"],
  "Nguồn đề xuất": ["Nguồn khuyến nghị"],
  "Đầu cấp nguồn": ["Nguồn cấp"],
  "Tản nhiệt": ["Làm mát", "Tản nhiệt kèm theo"],
  "Loại NAND": ["Bộ nhớ NAND"],
  "Không gian màu": ["Độ phủ màu"],
  "Phần mềm": ["Phần mềm hỗ trợ"],
  "Đèn LED": ["Đèn RGB", "LED RGB", "Đèn LED RGB"],
  "Kích thước": ["Kích thước tổng thể", "Kích thước card"],
};

const normalize = (label: string) => label.normalize("NFC").trim().replace(/\s+/g, " ").toLowerCase();

const CANONICAL = new Map<string, string>(
  Object.entries(SYNONYMS).flatMap(([canonical, aliases]) => [canonical, ...aliases].map((label) => [normalize(label), canonical] as const)),
);

/** Nhãn thống nhất để so sánh; nhãn không có trong bảng giữ nguyên (chỉ bỏ khoảng trắng thừa) */
export function canonicalSpecLabel(label: string): string {
  return CANONICAL.get(normalize(label)) ?? label.trim().replace(/\s+/g, " ");
}
