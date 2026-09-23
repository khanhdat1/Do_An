import ExcelJS from "exceljs";
import type { AdminOrderSummaryDto } from "../types/dto.js";
import { formatDateTime, ORDER_STATUS_LABEL, PAYMENT_METHOD_LABEL, PAYMENT_STATUS_LABEL, styleHeaderRow, VND_FORMAT } from "./excel-report.utils.js";

export interface OrderExportFilterLabels {
  status?: string;
  paymentStatus?: string;
  paymentMethod?: string;
}

const COLUMNS = [
  { key: "orderCode", header: "Mã đơn", width: 22 },
  { key: "recipientName", header: "Người nhận", width: 22 },
  { key: "recipientPhone", header: "Số điện thoại", width: 16 },
  { key: "paymentMethod", header: "Phương thức", width: 18 },
  { key: "itemCount", header: "Số lượng SP", width: 12 },
  { key: "totalAmount", header: "Tổng tiền (đ)", width: 16 },
  { key: "status", header: "Trạng thái đơn", width: 16 },
  { key: "paymentStatus", header: "Thanh toán", width: 16 },
  { key: "createdAt", header: "Thời gian đặt", width: 18 },
] as const;

/** Dựng file .xlsx từ đúng danh sách đơn `listAllOrdersForAdmin` đã lọc — không tính lại gì ở đây */
export async function buildOrdersReportWorkbook(orders: AdminOrderSummaryDto[], filters: OrderExportFilterLabels): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PCZone Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Đơn hàng");
  // Chỉ khai key/width ở đây (không có `header`) — để 3 dòng mô tả bên dưới tự chiếm hàng 1-3, không bị
  // ExcelJS tự ghi đè header lên hàng 1 như khi dùng thuộc tính `header` trong `sheet.columns`.
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));

  const appliedFilters = [
    filters.status ? `Trạng thái đơn: ${ORDER_STATUS_LABEL[filters.status] ?? filters.status}` : null,
    filters.paymentStatus ? `Thanh toán: ${PAYMENT_STATUS_LABEL[filters.paymentStatus] ?? filters.paymentStatus}` : null,
    filters.paymentMethod ? `Phương thức: ${PAYMENT_METHOD_LABEL[filters.paymentMethod] ?? filters.paymentMethod}` : null,
  ].filter((line): line is string => line !== null);

  sheet.addRow([]).getCell(1).value = "Danh sách đơn hàng PCZone";
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]).getCell(1).value = appliedFilters.length > 0 ? appliedFilters.join(" · ") : "Không lọc — mọi đơn hàng";
  sheet.addRow([]).getCell(1).value = `Xuất lúc: ${formatDateTime(new Date().toISOString())} — tổng ${orders.length} đơn`;
  sheet.addRow([]);

  const headerRow = sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.header])));
  styleHeaderRow(headerRow);

  for (const order of orders) {
    sheet.addRow({
      orderCode: order.orderCode,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      paymentMethod: PAYMENT_METHOD_LABEL[order.paymentMethod] ?? order.paymentMethod,
      itemCount: order.itemCount,
      totalAmount: order.totalAmount,
      status: ORDER_STATUS_LABEL[order.status] ?? order.status,
      paymentStatus: PAYMENT_STATUS_LABEL[order.paymentStatus] ?? order.paymentStatus,
      createdAt: formatDateTime(order.createdAt),
    });
  }
  sheet.getColumn("totalAmount").numFmt = VND_FORMAT;

  return workbook.xlsx.writeBuffer();
}
