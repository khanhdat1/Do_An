import ExcelJS from "exceljs";
import type { AdminDashboardSummaryDto, DashboardGranularityDto } from "../types/dto.js";
import { formatDate, formatDateTime, HEADER_FILL, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, styleHeaderRow, VND_FORMAT } from "./excel-report.utils.js";

const GRANULARITY_LABEL: Record<DashboardGranularityDto, string> = {
  day: "Ngày",
  week: "Tuần",
  month: "Tháng",
  year: "Năm",
};

/**
 * Sheet "Tổng quan": ghi rõ khoảng thời gian + cách tính, khớp đúng phần giải thích trên giao diện
 * `/admin` — người xem file không có ngữ cảnh trang web vẫn hiểu được số liệu nghĩa là gì.
 */
function addSummarySheet(workbook: ExcelJS.Workbook, summary: AdminDashboardSummaryDto): void {
  const sheet = workbook.addWorksheet("Tổng quan");
  sheet.columns = [{ width: 28 }, { width: 24 }];

  sheet.addRow(["Báo cáo doanh thu PCZone"]).font = { bold: true, size: 14 };
  sheet.addRow([
    `Khoảng thời gian: ${formatDate(summary.range.from)} – ${formatDate(summary.range.to)} (theo ${GRANULARITY_LABEL[summary.range.granularity]})`,
  ]);
  sheet.addRow([`Xuất lúc: ${formatDateTime(new Date().toISOString())}`]);
  sheet.addRow([]);

  const headerRow = sheet.addRow(["Chỉ số", "Giá trị"]);
  styleHeaderRow(headerRow);

  const rows: [string, number][] = [
    ["Tổng giá trị đơn (đ)", summary.revenue.grossOrderValue],
    ["Đã thanh toán (đ)", summary.revenue.paidAmount],
    ["Đã hoàn (đ)", summary.revenue.refundedAmount],
    ["Doanh thu thuần (đ)", summary.revenue.netRevenue],
    ["Số đơn trong kỳ", summary.orderCount],
    ["Sản phẩm đã bán trong kỳ", summary.productsSoldCount],
    ["Đơn đang chờ xử lý (hiện tại)", summary.pendingOrderCount],
    ["Tổng khách hàng (luỹ kế)", summary.totalCustomers],
  ];
  for (const [label, value] of rows) {
    const row = sheet.addRow([label, value]);
    row.getCell(2).numFmt = VND_FORMAT;
  }

  sheet.addRow([]);
  sheet.addRow(["Cách tính:"]).font = { italic: true };
  sheet.addRow(["Tổng giá trị đơn = mọi đơn đặt trong kỳ, kể cả đơn huỷ/chưa thanh toán."]).font = { italic: true, size: 10 };
  sheet.addRow(["Đã thanh toán / Đã hoàn = tiền thực nhận / thực trả lại khách phát sinh trong kỳ."]).font = { italic: true, size: 10 };
  sheet.addRow(["Doanh thu thuần = Đã thanh toán − Đã hoàn. Đơn huỷ/chưa thanh toán không tính vào doanh thu."]).font = { italic: true, size: 10 };
  sheet.addRow(["Đơn đang chờ xử lý / Tổng khách hàng là số liệu HIỆN TẠI, không theo kỳ đang lọc."]).font = { italic: true, size: 10 };
}

function addChartSheet(workbook: ExcelJS.Workbook, summary: AdminDashboardSummaryDto): void {
  const sheet = workbook.addWorksheet("Doanh thu theo kỳ");
  sheet.columns = [
    { header: "Mốc thời gian", key: "label", width: 20 },
    { header: "Doanh thu thuần (đ)", key: "netRevenue", width: 22 },
  ];
  styleHeaderRow(sheet.getRow(1));
  for (const point of summary.chart) {
    sheet.addRow({ label: point.label, netRevenue: point.netRevenue });
  }
  sheet.getColumn("netRevenue").numFmt = VND_FORMAT;
}

function addBestSellersSheet(workbook: ExcelJS.Workbook, summary: AdminDashboardSummaryDto): void {
  const sheet = workbook.addWorksheet("Sản phẩm bán chạy");
  sheet.columns = [
    { header: "Sản phẩm (trong kỳ)", key: "name", width: 42 },
    { header: "Số lượng đã bán", key: "quantitySold", width: 18 },
  ];
  styleHeaderRow(sheet.getRow(1));
  for (const product of summary.bestSellers) {
    sheet.addRow({ name: product.name, quantitySold: product.quantitySold });
  }
}

function addLowStockSheet(workbook: ExcelJS.Workbook, summary: AdminDashboardSummaryDto): void {
  const sheet = workbook.addWorksheet("Sắp hết hàng");
  sheet.columns = [
    { header: "Sản phẩm (hiện tại, không theo kỳ)", key: "name", width: 42 },
    { header: "Tồn kho", key: "inventoryQuantity", width: 14 },
    { header: "Ngưỡng cảnh báo", key: "lowStockThreshold", width: 16 },
  ];
  styleHeaderRow(sheet.getRow(1));
  for (const product of summary.lowStock) {
    sheet.addRow({ name: product.name, inventoryQuantity: product.inventoryQuantity, lowStockThreshold: product.lowStockThreshold });
  }
}

function addRecentOrdersSheet(workbook: ExcelJS.Workbook, summary: AdminDashboardSummaryDto): void {
  const sheet = workbook.addWorksheet("Đơn hàng gần đây");
  sheet.columns = [
    { header: "Mã đơn (hiện tại, không theo kỳ)", key: "orderCode", width: 22 },
    { header: "Người nhận", key: "recipientName", width: 22 },
    { header: "Phương thức", key: "paymentMethod", width: 18 },
    { header: "Tổng tiền (đ)", key: "totalAmount", width: 16 },
    { header: "Trạng thái đơn", key: "status", width: 16 },
    { header: "Thanh toán", key: "paymentStatus", width: 16 },
    { header: "Thời gian đặt", key: "createdAt", width: 18 },
  ];
  styleHeaderRow(sheet.getRow(1));
  for (const order of summary.recentOrders) {
    sheet.addRow({
      orderCode: order.orderCode,
      recipientName: order.recipientName,
      paymentMethod: PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod,
      totalAmount: order.totalAmount,
      status: ORDER_STATUS_LABEL[order.status] ?? order.status,
      paymentStatus: PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus,
      createdAt: formatDateTime(order.createdAt),
    });
  }
  sheet.getColumn("totalAmount").numFmt = VND_FORMAT;
}

/** Dựng file .xlsx đầy đủ 5 sheet từ đúng dữ liệu `getDashboardSummary` đã tính — không tính lại gì ở đây */
export async function buildDashboardReportWorkbook(summary: AdminDashboardSummaryDto): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PCZone Admin";
  workbook.created = new Date();

  addSummarySheet(workbook, summary);
  addChartSheet(workbook, summary);
  addBestSellersSheet(workbook, summary);
  addLowStockSheet(workbook, summary);
  addRecentOrdersSheet(workbook, summary);

  return workbook.xlsx.writeBuffer();
}
