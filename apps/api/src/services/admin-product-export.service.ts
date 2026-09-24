import ExcelJS from "exceljs";
import type { AdminProductSummaryDto } from "../types/dto.js";
import { PRODUCT_STATUS_LABEL, formatDateTime, styleHeaderRow, VND_FORMAT } from "./excel-report.utils.js";

export interface ProductExportFilterLabels {
  status?: string;
  category?: string;
  brand?: string;
  search?: string;
  lowStockOnly?: boolean;
}

const COLUMNS = [
  { key: "sku", header: "Mã SKU", width: 16 },
  { key: "name", header: "Tên sản phẩm", width: 42 },
  { key: "categoryName", header: "Danh mục", width: 20 },
  { key: "brand", header: "Hãng", width: 16 },
  { key: "status", header: "Trạng thái", width: 18 },
  { key: "sellingPrice", header: "Giá bán (đ)", width: 16 },
  { key: "costPrice", header: "Giá vốn (đ)", width: 16 },
  { key: "inventoryQuantity", header: "Tồn kho", width: 12 },
  { key: "reservedQuantity", header: "Đang giữ chỗ", width: 14 },
  { key: "lowStockFlag", header: "Cảnh báo tồn kho", width: 18 },
  { key: "soldCount", header: "Đã bán", width: 12 },
  { key: "updatedAt", header: "Cập nhật lúc", width: 18 },
] as const;

/** Dựng file .xlsx từ đúng danh sách sản phẩm `listAllProductsForAdmin` đã lọc — không tính lại gì ở đây */
export async function buildProductsReportWorkbook(products: AdminProductSummaryDto[], filters: ProductExportFilterLabels): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "PCZone Admin";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Sản phẩm");
  // Chỉ khai key/width ở đây (không có `header`) — để 3 dòng mô tả bên dưới tự chiếm hàng 1-3, không bị
  // ExcelJS tự ghi đè header lên hàng 1 như khi dùng thuộc tính `header` trong `sheet.columns`.
  sheet.columns = COLUMNS.map(({ key, width }) => ({ key, width }));

  const appliedFilters = [
    filters.status ? `Trạng thái: ${PRODUCT_STATUS_LABEL[filters.status] ?? filters.status}` : null,
    filters.category ? `Danh mục: ${filters.category}` : null,
    filters.brand ? `Hãng: ${filters.brand}` : null,
    filters.search ? `Tìm kiếm: "${filters.search}"` : null,
    filters.lowStockOnly ? "Chỉ sản phẩm sắp hết hàng" : null,
  ].filter((line): line is string => line !== null);

  sheet.addRow([]).getCell(1).value = "Danh sách sản phẩm PCZone";
  sheet.getRow(1).font = { bold: true, size: 14 };
  sheet.addRow([]).getCell(1).value = appliedFilters.length > 0 ? appliedFilters.join(" · ") : "Không lọc — mọi sản phẩm";
  sheet.addRow([]).getCell(1).value = `Xuất lúc: ${formatDateTime(new Date().toISOString())} — tổng ${products.length} sản phẩm`;
  sheet.addRow([]);

  const headerRow = sheet.addRow(Object.fromEntries(COLUMNS.map((c) => [c.key, c.header])));
  styleHeaderRow(headerRow);

  for (const product of products) {
    sheet.addRow({
      sku: product.sku,
      name: product.name,
      categoryName: product.categoryName,
      brand: product.brand ?? "—",
      status: PRODUCT_STATUS_LABEL[product.status] ?? product.status,
      sellingPrice: product.sellingPrice,
      costPrice: product.costPrice ?? null,
      inventoryQuantity: product.inventoryQuantity,
      reservedQuantity: product.reservedQuantity,
      lowStockFlag: product.lowStock ? "Sắp hết hàng" : "",
      soldCount: product.soldCount,
      updatedAt: formatDateTime(product.updatedAt),
    });
  }
  sheet.getColumn("sellingPrice").numFmt = VND_FORMAT;
  sheet.getColumn("costPrice").numFmt = VND_FORMAT;

  return workbook.xlsx.writeBuffer();
}
