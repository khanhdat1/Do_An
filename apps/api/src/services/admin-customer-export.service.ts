import ExcelJS from "exceljs";
import type { AdminCustomerSummaryDto } from "../types/dto.js";
import { formatDate, formatDateTime, styleHeaderRow, VND_FORMAT } from "./excel-report.utils.js";

export interface CustomerExportFilterLabels {
  search?: string;
  locked?: boolean;
}

const COLUMNS = [
  { key: "fullName", header: "Họ tên", width: 26 },
  { key: "email", header: "Email", width: 28 },
  { key: "phone", header: "Số điện thoại", width: 16 },
  { key: "status", header: "Trạng thái", width: 16 },
  { key: "orderCount", header: "Số đơn", width: 10 },
  { key: "totalSpent", header: "Tổng chi tiêu (đ)", width: 18 },
  { key: "createdAt", header: "Ngày đăng ký", width: 16 },
  { key: "lastLoginAt", header: "Đăng nhập gần nhất", width: 18 },
] as const;

/** Dựng file .xlsx từ đúng danh sách khách hàng `listAllCustomersForAdmin` đã lọc — không tính lại gì ở đây */
export async function buildCustomersReportWorkbook(customers: AdminCustomerSummaryDto[], filters: CustomerExportFilterLabels): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PCZone Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Khách hàng");
  // Chỉ khai key/width ở đây (không có `header`) — để 3 dòng mô tả bên dưới tự chiếm hàng 1-3, không bị
  // ExcelJS tự ghi đè header lên hàng 1 như khi dùng thuộc tính `header` trong `sheet.columns`.
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));

  const appliedFilters = [
    filters.search ? `Tìm kiếm: "${filters.search}"` : null,
    filters.locked === true ? "Chỉ tài khoản đã khoá" : filters.locked === false ? "Chỉ tài khoản đang hoạt động" : null,
  ].filter((line): line is string => line !== null);

  sheet.addRow([]).getCell(1).value = "Danh sách khách hàng PCZone";
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]).getCell(1).value = appliedFilters.length > 0 ? appliedFilters.join(" · ") : "Không lọc — mọi khách hàng";
  sheet.addRow([]).getCell(1).value = `Xuất lúc: ${formatDateTime(new Date().toISOString())} — tổng ${customers.length} khách hàng`;
  sheet.addRow([]);

  const headerRow = sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.header])));
  styleHeaderRow(headerRow);

  for (const customer of customers) {
    sheet.addRow({
      fullName: customer.fullName,
      email: customer.email,
      phone: customer.phone ?? "—",
      status: customer.isActive ? "Đang hoạt động" : "Đã khoá",
      orderCount: customer.orderCount,
      totalSpent: customer.totalSpent,
      createdAt: formatDate(customer.createdAt),
      lastLoginAt: customer.lastLoginAt ? formatDateTime(customer.lastLoginAt) : "—",
    });
  }
  sheet.getColumn("totalSpent").numFmt = VND_FORMAT;

  return workbook.xlsx.writeBuffer();
}
