// Sinh mã Mermaid cho tài liệu bảo vệ PCZone. ERD đọc thẳng từ packages/db/prisma/schema.prisma (không gõ tay);
// các sơ đồ khác viết theo luồng đã đọc trong mã nguồn. Ghi ra docs/bao-ve/so-do/*.mmd + manifest.json
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Gốc dự án pczone, tính từ vị trí script (docs/bao-ve/cong-cu) — chạy được ở mọi bản clone
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const OUT = path.join(ROOT, "docs/bao-ve/so-do");
fs.mkdirSync(OUT, { recursive: true });

/* ------------------------------------------------------------------ */
/*  Đọc schema Prisma                                                  */
/* ------------------------------------------------------------------ */
const schema = fs.readFileSync(path.join(ROOT, "packages/db/prisma/schema.prisma"), "utf8");
const enumNames = new Set([...schema.matchAll(/^enum (\w+) \{/gm)].map((m) => m[1]));
const models = {};
for (const m of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
  const [, name, body] = m;
  const fields = [];
  const uniques = [];
  for (const raw of body.split("\n")) {
    const line = raw.replace(/\/\/.*$/, "").trim();
    if (!line) continue;
    if (line.startsWith("@@unique")) {
      uniques.push([...line.matchAll(/\b(\w+)\b(?=[,\]])/g)].map((x) => x[1]));
      continue;
    }
    if (line.startsWith("@@")) continue;
    const fm = /^(\w+)\s+(\w+)(\[\])?(\?)?\s*(.*)$/.exec(line);
    if (!fm) continue;
    const [, fname, ftype, list, optional, attrs] = fm;
    const rel = /@relation\(([^)]*)\)/.exec(attrs);
    const relFields = rel ? (/fields:\s*\[([^\]]*)\]/.exec(rel[1])?.[1] ?? "").split(",").map((s) => s.trim()).filter(Boolean) : [];
    fields.push({ name: fname, type: ftype, list: Boolean(list), optional: Boolean(optional), attrs, relFields, isId: /@id\b/.test(attrs), isUnique: /@unique\b/.test(attrs) });
  }
  models[name] = { name, fields, uniques };
}
const modelNames = new Set(Object.keys(models));

function mermaidType(type) {
  if (enumNames.has(type)) return type;
  return { String: "string", Int: "int", BigInt: "bigint", Float: "float", Decimal: "decimal", Boolean: "bool", DateTime: "datetime", Json: "json", Bytes: "bytes" }[type] ?? type;
}

/** Quan hệ: phía giữ khoá ngoại (có @relation(fields)) là phía "nhiều" (hoặc "một" nếu khoá ngoại là duy nhất) */
function relationsOf(modelName) {
  const model = models[modelName];
  const result = [];
  for (const field of model.fields) {
    if (!modelNames.has(field.type) || field.relFields.length === 0) continue;
    const fkUnique =
      (field.relFields.length === 1 && model.fields.find((f) => f.name === field.relFields[0])?.isUnique) ||
      model.uniques.some((u) => u.length === field.relFields.length && u.every((c) => field.relFields.includes(c)));
    const parentSide = field.optional ? "|o" : "||";
    const childSide = fkUnique ? "o|" : "o{";
    result.push({ parent: field.type, child: modelName, line: `  ${field.type} ${parentSide}--${childSide} ${modelName} : "${field.relFields.join(", ")}"` });
  }
  return result;
}

function entityBlock(modelName, maxAttrs = 9) {
  const model = models[modelName];
  const fkNames = new Set(model.fields.flatMap((f) => f.relFields));
  const scalar = model.fields.filter((f) => !modelNames.has(f.type));
  const picked = [];
  const add = (f) => { if (!picked.includes(f)) picked.push(f); };
  scalar.filter((f) => f.isId).forEach(add);
  scalar.filter((f) => fkNames.has(f.name)).forEach(add);
  scalar.filter((f) => f.isUnique).forEach(add);
  for (const f of scalar) {
    if (picked.length >= maxAttrs) break;
    if (["createdAt", "updatedAt"].includes(f.name)) continue;
    add(f);
  }
  const lines = picked.map((f) => {
    const keys = [f.isId ? "PK" : null, fkNames.has(f.name) ? "FK" : null, f.isUnique ? "UK" : null].filter(Boolean).join(", ");
    return `    ${mermaidType(f.type)} ${f.name}${keys ? " " + keys : ""}`;
  });
  return `  ${modelName} {\n${lines.join("\n")}\n  }`;
}

function erd(group) {
  const inGroup = new Set(group);
  const rels = [];
  const stubs = new Set();
  for (const name of group) {
    for (const r of relationsOf(name)) {
      if (!inGroup.has(r.parent)) stubs.add(r.parent);
      rels.push(r.line);
    }
  }
  // Quan hệ từ bảng ngoài nhóm trỏ vào bảng trong nhóm (vd Order -> Voucher) — chỉ vẽ khi bảng kia có trong nhóm
  const blocks = group.map((name) => entityBlock(name));
  const stubBlocks = [...stubs].map((name) => `  ${name} {\n    string id PK\n  }`);
  return ["erDiagram", ...blocks, ...stubBlocks, ...[...new Set(rels)]].join("\n");
}

function erdOverview() {
  const rels = Object.keys(models).flatMap((name) => relationsOf(name).map((r) => r.line));
  const lonely = Object.keys(models).filter((name) => !rels.some((line) => new RegExp(`\\b${name}\\b`).test(line)));
  // Bố cục ELK: dagre xếp hơn 15 bảng con của User thành một hàng rất dẹt (hoặc một cột rất cao nếu đổi hướng)
  return ["---", "config:", "  layout: elk", "---", "erDiagram", ...[...new Set(rels)], ...lonely.map((name) => `  ${name}`)].join("\n");
}

/* ------------------------------------------------------------------ */
/*  Nhóm bảng                                                          */
/* ------------------------------------------------------------------ */
const GROUPS = {
  "erd-san-pham": { title: "ERD — Sản phẩm & kho", tables: ["Category", "Brand", "Product", "ProductImage", "ProductSpec", "ProductEmbedding", "InventoryTransaction"] },
  "erd-nguoi-dung": { title: "ERD — Người dùng & xác thực", tables: ["User", "OAuthAccount", "RefreshToken", "PasswordResetToken", "EmailVerificationToken", "Address", "AdminAuditLog"] },
  "erd-don-hang": { title: "ERD — Giỏ hàng, đơn hàng & thanh toán", tables: ["Cart", "CartItem", "Order", "OrderItem", "OrderStatusHistory", "Payment", "Voucher", "VoucherRedemption"] },
  "erd-ai-tuong-tac": { title: "ERD — AI, Build PC, đánh giá & nội dung", tables: ["AiConversation", "AiMessage", "AiSearchLog", "PcBuild", "PcBuildItem", "Review", "WishlistItem", "Banner", "Setting"] },
};
const grouped = new Set(Object.values(GROUPS).flatMap((g) => g.tables));
const missing = [...modelNames].filter((name) => !grouped.has(name));
if (missing.length) throw new Error(`Bảng chưa xếp nhóm: ${missing.join(", ")}`);

/* ------------------------------------------------------------------ */
/*  Các sơ đồ viết theo mã                                             */
/* ------------------------------------------------------------------ */
const HAND = {
  "kien-truc": {
    title: "Kiến trúc hệ thống",
    code: `flowchart LR
  subgraph NguoiDung["Người dùng"]
    KH["Khách hàng<br/>(trình duyệt)"]
    QT["Quản trị viên<br/>(trình duyệt)"]
  end
  subgraph MayChu["Máy chủ — Docker Compose"]
    CD["Caddy<br/>HTTPS tự động, reverse proxy"]
    WEB["Web — Next.js 16<br/>React 19, SSR/ISR, Tailwind 4"]
    API["API — Express 5<br/>TypeScript, Zod, Prisma 6"]
    DB[("MySQL 8<br/>31 bảng")]
    FS[/"Ảnh sản phẩm<br/>& banner"/]
  end
  subgraph BenNgoai["Dịch vụ bên ngoài"]
    GEM["Google Gemini<br/>chat + embedding"]
    OA["Google / Facebook<br/>OAuth 2.0"]
    RS["Resend<br/>gửi email"]
    QR["VietQR<br/>ảnh mã QR"]
  end
  KH -->|HTTPS| CD
  QT -->|HTTPS| CD
  CD -->|"/api/*"| API
  CD -->|"/images/banners/*"| FS
  CD -->|"các trang"| WEB
  WEB -->|"dữ liệu dựng trang"| API
  WEB --- FS
  API -->|Prisma| DB
  API -->|"ghi banner"| FS
  API --> GEM
  API --> OA
  API --> RS
  KH -.->|"ảnh QR chuyển khoản"| QR`,
  },
  "use-case-khach": {
    title: "Use case — phía khách hàng",
    code: `flowchart LR
  KVL["Khách vãng lai"]:::actor
  KH["Khách hàng<br/>(đã đăng nhập)"]:::actor
  GEM["Google Gemini"]:::ext
  OA["Google / Facebook"]:::ext
  KH -.->|"kế thừa"| KVL
  subgraph HT["Hệ thống PCZone — phía khách"]
    U1(["Xem danh mục, chi tiết sản phẩm"])
    U2(["Tìm kiếm từ khoá, tìm bằng AI"])
    U3(["So sánh sản phẩm"])
    U4(["Quản lý giỏ hàng"])
    U5(["Tra cứu đơn bằng mã đơn + SĐT"])
    U6(["Hỏi trợ lý AI"])
    U7(["Tự ráp cấu hình, kiểm tra tương thích"])
    U8(["AI gợi ý cấu hình theo ngân sách"])
    U9(["Đăng ký, đăng nhập: email, Google, Facebook"])
    U10(["Đặt hàng: COD, chuyển khoản, MoMo, mã giảm giá"])
    U11(["Theo dõi, tự huỷ đơn"])
    U12(["Đánh giá sản phẩm đã nhận"])
    U13(["Sổ địa chỉ, yêu thích, cấu hình đã lưu"])
  end
  KVL --- U1 & U2 & U3 & U4 & U5 & U6 & U7 & U8 & U9
  KH --- U10 & U11 & U12 & U13
  U2 & U6 & U8 -.- GEM
  U9 -.- OA
  classDef actor fill:#fff7ed,stroke:#c2410c,stroke-width:2px,color:#1f2937
  classDef ext fill:#f1f5f9,stroke:#475569,stroke-dasharray:4 3,color:#1f2937`,
  },
  "use-case-quan-tri": {
    title: "Use case — khu quản trị (theo phân quyền)",
    code: `flowchart LR
  NVDH["Nhân viên đơn hàng"]:::actor
  NVSP["Nhân viên sản phẩm"]:::actor
  QL["Quản lý"]:::actor
  CW["Chủ website"]:::actor
  QL -.->|"kế thừa"| NVDH
  QL -.->|"kế thừa"| NVSP
  CW -.->|"kế thừa"| QL
  subgraph HT["Hệ thống PCZone — khu quản trị"]
    A0(["Đăng nhập quản trị, xác thực 2 bước"])
    A1(["Xử lý đơn: xác nhận, đóng gói, giao, mã vận đơn"])
    A2(["Xác nhận chuyển khoản, huỷ, hoàn trả, hoàn tiền"])
    A3(["Thêm, sửa, ẩn sản phẩm, duyệt DRAFT"])
    A4(["Nhập, xuất, điều chỉnh tồn kho"])
    A5(["Duyệt, trả lời đánh giá"])
    A6(["Quản lý khách hàng, khoá tài khoản"])
    A7(["Mã giảm giá, banner trang chủ"])
    A8(["Báo cáo doanh thu, xuất Excel"])
    A9(["Tài khoản quản trị, phân quyền"])
    A10(["Cài đặt hệ thống"])
  end
  NVDH --- A0 & A1 & A2
  NVSP --- A0 & A3 & A4 & A5
  QL --- A6 & A7 & A8
  CW --- A9 & A10
  classDef actor fill:#fff7ed,stroke:#c2410c,stroke-width:2px,color:#1f2937`,
  },
  "trang-thai-don": {
    title: "Vòng đời đơn hàng (máy trạng thái)",
    code: `stateDiagram-v2
  direction TB
  state "Chờ xác nhận" as PENDING
  state "Đã xác nhận" as CONFIRMED
  state "Đang đóng gói" as PACKING
  state "Đang giao hàng" as SHIPPING
  state "Đã giao hàng" as DELIVERED
  state "Đã huỷ" as CANCELLED
  state "Đã hoàn trả" as RETURNED
  [*] --> PENDING: Khách đặt hàng
  PENDING --> CONFIRMED: Nhân viên xác nhận / đã nhận tiền
  CONFIRMED --> PACKING: Bắt đầu đóng gói
  PACKING --> SHIPPING: Bắt đầu giao (mã vận đơn)
  SHIPPING --> DELIVERED: Giao thành công
  PENDING --> CANCELLED: Khách huỷ (chưa trả tiền) / nhân viên huỷ
  CONFIRMED --> CANCELLED
  PACKING --> CANCELLED: Nhân viên huỷ
  SHIPPING --> CANCELLED
  SHIPPING --> RETURNED: Giao không thành công
  DELIVERED --> RETURNED: Khách trả hàng
  DELIVERED --> [*]
  CANCELLED --> [*]
  RETURNED --> [*]
  note right of CANCELLED
    Huỷ, hoàn trả: hoàn kho, trả lượt mã giảm giá.
    Đơn đã thanh toán: hoàn tiền thủ công (PAID → REFUNDED)
  end note`,
  },
  "tuan-tu-dat-hang": {
    title: "Sơ đồ tuần tự — Đặt hàng",
    code: `sequenceDiagram
  autonumber
  actor KH as Khách hàng
  participant W as Web (Next.js)
  participant A as API (Express)
  participant DB as MySQL
  KH->>W: Bấm "Đặt hàng" (địa chỉ, phương thức, mã giảm giá)
  W->>A: POST /api/orders
  A->>A: Kiểm tra dữ liệu (Zod), phương thức thanh toán đang bật
  A->>DB: BEGIN TRANSACTION
  A->>DB: Đọc giỏ hàng + sản phẩm
  alt Hết hàng hoặc sản phẩm ngừng bán
    A-->>W: 409 "không còn đủ số lượng"
  end
  A->>DB: Kiểm tra lại mã giảm giá (điều kiện, lượt dùng)
  A->>A: Tổng = tạm tính − giảm giá + phí ship (tính trên tạm tính trước giảm)
  A->>DB: Tạo Order (mã PCZyyyymmdd-nnnn), ghi nhận mã giảm giá
  loop Từng sản phẩm
    A->>DB: Trừ kho có điều kiện (tồn ≥ số lượng), InventoryTransaction, OrderItem (giá tại lúc mua)
  end
  A->>DB: OrderStatusHistory (Chờ xác nhận), Payment (chờ thanh toán), xoá giỏ
  A->>DB: COMMIT
  A-->>W: 201 Created
  W-->>KH: Trang đơn hàng (chuyển khoản / MoMo: hiện mã QR)`,
  },
  "tuan-tu-ai-cau-hinh": {
    title: "Sơ đồ tuần tự — AI gợi ý cấu hình",
    code: `sequenceDiagram
  autonumber
  actor KH as Khách
  participant W as Web
  participant A as API
  participant DB as MySQL
  participant G as Gemini
  KH->>W: "PC chơi game tầm 25 triệu"
  W->>A: POST /api/ai/build
  A->>A: Tính năng đang bật? Giới hạn tần suất
  A->>DB: Linh kiện còn hàng + thông số chuẩn hoá
  A->>A: Đọc ngân sách. Thấp hơn bộ rẻ nhất thì báo ngay, không gọi AI
  A->>G: Danh mục linh kiện (mã) + yêu cầu, đòi trả JSON
  G-->>A: Cấu hình: mã từng món + lý do
  A->>A: Bỏ mã không có thật, kiểm tra 9 luật tương thích
  opt Còn lỗi
    A->>G: Nhờ sửa đúng 1 lần, kèm danh sách lỗi
    G-->>A: Cấu hình đã sửa
  end
  opt Vẫn vượt ngân sách
    A->>A: Tự đổi món rẻ hơn cùng loại (nhánh cận, không dùng AI), giữ tương thích
  end
  A->>DB: Lưu PcBuild + mã chia sẻ 8 ký tự
  A-->>W: Cấu hình, lý do, trạng thái sửa và điều chỉnh
  W-->>KH: Cấu hình + kiểm tra tương thích + link chia sẻ`,
  },
  "tuan-tu-tro-ly-ai": {
    title: "Sơ đồ tuần tự — Trợ lý AI (RAG)",
    code: `sequenceDiagram
  autonumber
  actor KH as Khách
  participant W as Web
  participant A as API
  participant DB as MySQL
  participant G as Gemini
  KH->>W: "Laptop đồ hoạ dưới 30 triệu?"
  W->>A: POST /api/ai/chat
  A->>A: Tính năng đang bật? Giới hạn tần suất
  A->>DB: Lưu câu hỏi vào hội thoại
  A->>A: Tách cụm giá "dưới 30 triệu"
  A->>G: Embedding câu hỏi
  G-->>A: Vector
  A->>A: Cosine similarity với chỉ mục embedding sản phẩm → 8 ứng viên
  A->>DB: Giá, tồn kho thật của sản phẩm ứng viên
  A->>G: Sản phẩm ứng viên + 12 tin nhắn gần nhất + câu hỏi (stream)
  loop Từng đoạn trả lời
    G-->>A: đoạn chữ
    A-->>W: SSE "chunk"
  end
  A->>A: Tự đối chiếu sản phẩm được nhắc (không tin AI tự khai)
  A->>DB: Lưu câu trả lời + sản phẩm trích dẫn
  A-->>W: SSE "done" + sản phẩm trích dẫn
  W-->>KH: Câu trả lời + thẻ sản phẩm có link`,
  },
  "tuan-tu-dang-nhap-mxh": {
    title: "Sơ đồ tuần tự — Đăng nhập Google / Facebook",
    code: `sequenceDiagram
  autonumber
  actor KH as Khách
  participant A as API
  participant P as Google / Facebook
  participant DB as MySQL
  KH->>A: GET /api/auth/google
  A-->>KH: Cookie state (httpOnly) + chuyển sang Google
  KH->>P: Chọn tài khoản, đồng ý
  P-->>A: GET /api/auth/google/callback?code&state
  A->>A: So state với cookie (chống giả mạo yêu cầu)
  A->>P: Đổi code lấy hồ sơ (máy chủ với máy chủ, có client secret)
  P-->>A: Mã tài khoản, email, tên, ảnh
  A->>DB: Tìm OAuthAccount theo (nhà cung cấp, mã tài khoản)
  alt Đã liên kết trước đó
    A->>DB: Đăng nhập vào User đó
  else Chưa có User nào dùng email này
    A->>DB: Tạo User + OAuthAccount
  else Email trùng User có sẵn
    A->>A: Google, email đã xác minh: liên kết. Facebook: từ chối (chống chiếm trước tài khoản)
  end
  A->>DB: Refresh token (lưu dạng băm), gộp giỏ hàng khách
  A-->>KH: Cookie phiên httpOnly + chuyển về trang trước đó`,
  },
};

/* ------------------------------------------------------------------ */
/*  Ghi file                                                           */
/* ------------------------------------------------------------------ */
const manifest = [];
function write(id, title, code) {
  fs.writeFileSync(path.join(OUT, `${id}.mmd`), code + "\n");
  manifest.push({ id, title });
}
write("kien-truc", HAND["kien-truc"].title, HAND["kien-truc"].code);
write("use-case-khach", HAND["use-case-khach"].title, HAND["use-case-khach"].code);
write("use-case-quan-tri", HAND["use-case-quan-tri"].title, HAND["use-case-quan-tri"].code);
write("erd-tong-quat", `ERD tổng quát — ${modelNames.size} bảng`, erdOverview());
for (const [id, group] of Object.entries(GROUPS)) write(id, group.title, erd(group.tables));
for (const id of ["trang-thai-don", "tuan-tu-dat-hang", "tuan-tu-ai-cau-hinh", "tuan-tu-tro-ly-ai", "tuan-tu-dang-nhap-mxh"]) write(id, HAND[id].title, HAND[id].code);
fs.writeFileSync(path.join(OUT, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Đã ghi ${manifest.length} sơ đồ vào ${OUT}; ${modelNames.size} bảng, ${enumNames.size} enum`);
