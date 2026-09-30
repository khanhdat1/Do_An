// Dựng trang "Hồ sơ bảo vệ PCZone": nội dung + 13 sơ đồ SVG (đã vẽ sẵn từ docs/bao-ve/so-do) nhúng thẳng vào trang
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Gốc dự án pczone, tính từ vị trí script (docs/bao-ve/cong-cu) — chạy được ở mọi bản clone
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const DIR = path.join(ROOT, "docs/bao-ve/so-do");
const OUT = process.argv[2];
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));
const titleOf = Object.fromEntries(manifest.map((m) => [m.id, m.title]));

let figureNo = 0;
function figure(id, caption, { wide = false } = {}) {
  figureNo += 1;
  const svg = fs.readFileSync(path.join(DIR, `${id}.svg`), "utf8").replace(/<\?xml[^>]*>/, "");
  return `<figure class="fig${wide ? " wide" : ""}" id="hinh-${id}">
  <div class="fig-canvas" tabindex="0" aria-label="${titleOf[id]}">${svg}</div>
  <figcaption><span class="fig-no">Hình ${figureNo}.</span> ${caption}<span class="fig-file">so-do/${id}.png · .svg</span></figcaption>
</figure>`;
}

const html = `<title>Hồ sơ bảo vệ PCZone</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700&family=Saira:wght@600;700&family=JetBrains+Mono:wght@400;500&display=swap">
<style>
/* Bố cục: hồ sơ đọc một cột (~64ch) + mục lục dính bên trái trên màn rộng; hình rộng tràn ra tối đa 1100px, cuộn ngang
   khi cần. Màu lấy từ nhận diện PCZone: mực xanh đen + cam (bản đậm, đạt tương phản) */
:root {
  --bg: #f4f5f7;
  --paper: #ffffff;
  --ink: #111826;
  --muted: #4a5568;
  --line: #dde1e8;
  --accent: #c2410c;
  --accent-soft: #fff1e7;
  --ok: #166534;
  --ok-soft: #e8f5ec;
  --warn: #92400e;
  --warn-soft: #fdf3e2;
  --no: #9f1239;
  --no-soft: #fdecef;
  --figure: #ffffff;
  --font-display: "Saira", "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif;
  --font-body: "Be Vietnam Pro", "Segoe UI", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, Consolas, monospace;
}
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) {
    --bg: #0b111c; --paper: #121a28; --ink: #e7ebf2; --muted: #a8b2c3; --line: #263247;
    --accent: #fb923c; --accent-soft: #2a1a10; --ok: #86efac; --ok-soft: #10261a; --warn: #fcd34d; --warn-soft: #2a2110;
    --no: #fda4af; --no-soft: #2a1218; color-scheme: dark;
  }
}
:root[data-theme="dark"] {
  --bg: #0b111c; --paper: #121a28; --ink: #e7ebf2; --muted: #a8b2c3; --line: #263247;
  --accent: #fb923c; --accent-soft: #2a1a10; --ok: #86efac; --ok-soft: #10261a; --warn: #fcd34d; --warn-soft: #2a2110;
  --no: #fda4af; --no-soft: #2a1218; color-scheme: dark;
}
* { box-sizing: border-box; }
body { background: var(--bg); color: var(--ink); font: 400 15px/1.65 var(--font-body); margin: 0; }
a { color: var(--accent); text-underline-offset: 2px; }
a:focus-visible, .fig-canvas:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 4px; }
code, .mono { font-family: var(--font-mono); font-size: 0.86em; }
code { background: var(--accent-soft); padding: 0.1em 0.35em; border-radius: 4px; overflow-wrap: anywhere; }
.page { display: grid; grid-template-columns: minmax(0, 1fr); gap: 32px; max-width: 1180px; margin: 0 auto; padding-inline: 16px; padding-block: 28px 64px; }
@media (min-width: 1100px) { .page { grid-template-columns: 220px minmax(0, 1fr); padding-inline: 24px; } }

/* Mục lục */
.toc { font-size: 13px; }
.toc h2 { font: 700 11px/1 var(--font-body); letter-spacing: 0.08em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
.toc ol { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px 14px; }
.toc a { color: var(--ink); text-decoration: none; }
.toc a:hover { color: var(--accent); }
@media (min-width: 1100px) {
  .toc { position: sticky; top: calc(env(safe-area-inset-top, 0px) + 24px); align-self: start; }
  .toc ol { flex-direction: column; gap: 7px; border-left: 2px solid var(--line); padding-left: 14px; }
}

/* Nội dung */
main { min-width: 0; }
.head { border-bottom: 1px solid var(--line); padding-bottom: 22px; margin-bottom: 8px; }
.eyebrow { font: 600 12px/1 var(--font-body); letter-spacing: 0.09em; text-transform: uppercase; color: var(--accent); margin: 0; }
h1 { font: 700 clamp(30px, 5vw, 44px)/1.1 var(--font-display); margin: 10px 0 12px; text-wrap: balance; letter-spacing: 0.01em; }
.lede { font-size: 16px; color: var(--muted); max-width: 64ch; margin: 0; }
.meta { display: flex; flex-wrap: wrap; gap: 8px 18px; margin-top: 14px; font-size: 13px; color: var(--muted); }
section { padding-top: 34px; scroll-margin-top: 16px; }
h2 { font: 700 24px/1.2 var(--font-display); margin: 0 0 6px; text-wrap: balance; }
h2 .num { color: var(--accent); margin-right: 8px; }
h3 { font: 600 16px/1.35 var(--font-body); margin: 22px 0 6px; }
.prose { max-width: 70ch; }
.prose p { margin: 8px 0; }
.note { font-size: 13.5px; color: var(--muted); max-width: 70ch; }

/* Số liệu */
.facts { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; margin-top: 14px; }
@media (min-width: 720px) { .facts { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
.fact { background: var(--paper); padding: 12px 14px; }
.fact b { display: block; font: 700 24px/1.1 var(--font-display); font-variant-numeric: tabular-nums; }
.fact span { font-size: 13px; color: var(--muted); }

/* Bảng */
.table-wrap { overflow-x: auto; margin-top: 12px; border: 1px solid var(--line); border-radius: 10px; background: var(--paper); }
table { border-collapse: collapse; width: 100%; font-size: 14px; }
th, td { text-align: left; padding: 9px 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
thead th { font-size: 12px; letter-spacing: 0.04em; text-transform: uppercase; color: var(--muted); background: var(--bg); }
tbody tr:last-child td { border-bottom: 0; }
td.yes, td.nope { text-align: center; font-weight: 700; }
td.yes { color: var(--ok); }
td.nope { color: var(--muted); }

/* Hình */
.fig { margin: 18px 0 8px; }
.fig-canvas { background: var(--figure); border: 1px solid var(--line); border-radius: 10px; padding: 14px; overflow-x: auto; }
.fig-canvas svg { display: block; max-width: 100%; height: auto; margin: 0 auto; }
.fig.wide .fig-canvas svg { max-width: none; width: 2600px; }
figcaption { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; font-size: 13.5px; color: var(--muted); margin-top: 8px; }
.fig-no { font-weight: 700; color: var(--ink); }
.fig-file { font-family: var(--font-mono); font-size: 12px; margin-left: auto; }

/* Kịch bản demo */
.steps { list-style: none; counter-reset: step; margin: 14px 0 0; padding: 0; display: grid; gap: 10px; }
.steps > li { counter-increment: step; display: grid; grid-template-columns: 44px minmax(0, 1fr); gap: 4px 12px; background: var(--paper); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; }
.steps > li::before { content: counter(step); grid-row: span 3; font: 700 22px/1 var(--font-display); color: var(--accent); }
.steps .time { font: 500 12px/1.4 var(--font-mono); color: var(--muted); }
.steps h3 { margin: 0; }
.steps p { margin: 2px 0 0; }
.steps .point { font-size: 13.5px; color: var(--muted); }
.steps .point b { color: var(--ink); font-weight: 600; }
.checklist { margin: 10px 0 0; padding-left: 20px; max-width: 72ch; }
.checklist li { margin: 4px 0; }

/* Hỏi đáp */
.qa { display: grid; gap: 12px; margin-top: 12px; }
.qa div { border-left: 3px solid var(--accent); padding: 2px 0 2px 14px; max-width: 74ch; }
.qa b { display: block; }
.qa p { margin: 2px 0 0; color: var(--muted); }

/* Tình trạng */
.status { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 12px; margin-top: 14px; }
.status > div { border-radius: 10px; padding: 12px 16px; border: 1px solid var(--line); background: var(--paper); min-width: 0; }
.status h3 { margin: 0 0 6px; display: flex; align-items: center; gap: 8px; }
.pill { font: 600 11px/1 var(--font-body); letter-spacing: 0.05em; text-transform: uppercase; padding: 5px 8px; border-radius: 999px; }
.pill.ok { color: var(--ok); background: var(--ok-soft); }
.pill.warn { color: var(--warn); background: var(--warn-soft); }
.pill.no { color: var(--no); background: var(--no-soft); }
.status ul { margin: 0; padding-left: 18px; font-size: 14px; }
.status li { margin: 5px 0; }
@media (prefers-reduced-motion: no-preference) { html { scroll-behavior: smooth; } }
</style>

<div class="page">
<nav class="toc" aria-label="Mục lục">
  <h2>Mục lục</h2>
  <ol>
    <li><a href="#tong-quan">1. Tổng quan &amp; số liệu</a></li>
    <li><a href="#kien-truc">2. Kiến trúc &amp; công nghệ</a></li>
    <li><a href="#use-case">3. Use case &amp; phân quyền</a></li>
    <li><a href="#csdl">4. Cơ sở dữ liệu</a></li>
    <li><a href="#don-hang">5. Vòng đời đơn hàng</a></li>
    <li><a href="#luong">6. Luồng xử lý chính</a></li>
    <li><a href="#chat-luong">7. Kiểm thử &amp; bảo mật</a></li>
    <li><a href="#demo">8. Kịch bản demo</a></li>
    <li><a href="#hoi-dap">9. Câu hỏi hội đồng</a></li>
    <li><a href="#tinh-trang">10. Tình trạng &amp; hướng phát triển</a></li>
  </ol>
</nav>

<main>
<header class="head">
  <p class="eyebrow">Đồ án chuyên ngành · Hồ sơ bảo vệ</p>
  <h1>PCZone — website bán PC, laptop và linh kiện có trợ lý AI</h1>
  <p class="lede">Cửa hàng trực tuyến đầy đủ luồng mua bán và quản trị, kèm ba tính năng AI chỉ gợi ý từ hàng đang bán: tìm kiếm ngữ nghĩa, trợ lý tư vấn và gợi ý cấu hình PC có kiểm tra tương thích bằng luật.</p>
  <div class="meta"><span>Số liệu chốt ngày 30/09/2026</span><span>Mã nguồn: github.com/khanhdat1/Do_An</span><span>Sơ đồ sinh từ mã nguồn thật</span></div>
</header>

<section id="tong-quan">
  <h2><span class="num">1</span>Tổng quan &amp; số liệu</h2>
  <div class="prose">
    <p>Monorepo TypeScript gồm web (Next.js), API (Express), cơ sở dữ liệu dùng chung (Prisma + MySQL), bộ thu thập dữ liệu demo và bộ kiểm thử đầu-cuối. Khách mua hàng như một cửa hàng thật; nhân viên xử lý đơn, kho, nội dung ở khu quản trị riêng có phân quyền theo từng thao tác.</p>
  </div>
  <div class="facts">
    <div class="fact"><b>119</b><span>API endpoint (Express)</span></div>
    <div class="fact"><b>48</b><span>trang web: 26 khách, 22 quản trị</span></div>
    <div class="fact"><b>31</b><span>bảng CSDL · 13 enum · 12 migration</span></div>
    <div class="fact"><b>~436</b><span>sản phẩm demo, ảnh thật của hãng</span></div>
    <div class="fact"><b>465</b><span>kiểm thử đơn vị (API, 15 bộ)</span></div>
    <div class="fact"><b>56</b><span>kịch bản kiểm thử đầu-cuối</span></div>
    <div class="fact"><b>129</b><span>component React</span></div>
    <div class="fact"><b>~47k</b><span>dòng TypeScript (không tính test)</span></div>
  </div>
</section>

<section id="kien-truc">
  <h2><span class="num">2</span>Kiến trúc &amp; công nghệ</h2>
  <div class="prose">
    <p>Trình duyệt chỉ nói chuyện với một tên miền. Caddy cấp HTTPS và chia đường: <code>/api/*</code> vào API, banner quản trị tải lên đọc thẳng từ ổ lưu trữ, còn lại vào web. Web dựng trang ở máy chủ (SSR/ISR, bộ nhớ đệm 60 giây) và gọi API qua mạng nội bộ Docker.</p>
  </div>
  ${figure("kien-truc", "Kiến trúc hệ thống khi triển khai bằng Docker Compose")}
  <div class="table-wrap"><table>
    <thead><tr><th>Tầng</th><th>Công nghệ</th><th>Ghi chú</th></tr></thead>
    <tbody>
      <tr><td>Web</td><td>Next.js 16.3 (App Router), React 19.2, Tailwind CSS 4.3</td><td>SSR/ISR, Server Components, Recharts cho biểu đồ quản trị</td></tr>
      <tr><td>API</td><td>Express 5.2, Zod 4.6, TypeScript 5.9</td><td>Kiểm tra dữ liệu mọi route, helmet, giới hạn tần suất, chống CSRF theo Origin</td></tr>
      <tr><td>Dữ liệu</td><td>MySQL 8, Prisma 6.19</td><td>31 bảng, transaction cho đặt hàng/kho, migration có phiên bản</td></tr>
      <tr><td>AI</td><td>Google Gemini qua API tương thích OpenAI</td><td>Chat <code>gemini-3.1-flash-lite</code>, embedding <code>gemini-embedding-2-preview</code>, tìm theo cosine trong bộ nhớ</td></tr>
      <tr><td>Xác thực</td><td>JWT + refresh token xoay vòng, bcrypt, OAuth 2.0, TOTP</td><td>Phiên quản trị tách hẳn phiên khách; xác thực 2 bước cho quản trị</td></tr>
      <tr><td>Dịch vụ ngoài</td><td>Resend (email), VietQR (mã QR), Google/Facebook</td><td>Thiếu khoá thì tính năng tự báo “chưa cấu hình”</td></tr>
      <tr><td>Kiểm thử</td><td>tsx (kiểm thử đơn vị), Playwright 1.63 + axe-core</td><td>Đầu-cuối chạy trên API + web + DB riêng</td></tr>
      <tr><td>Triển khai</td><td>Docker Compose, Caddy 2</td><td>HTTPS tự động, script chuyển dữ liệu từ máy dev</td></tr>
    </tbody>
  </table></div>
</section>

<section id="use-case">
  <h2><span class="num">3</span>Use case &amp; phân quyền</h2>
  <div class="prose"><p>Khách hàng kế thừa mọi thao tác của khách vãng lai. Ở khu quản trị, vai trò cao kế thừa vai trò thấp; quyền được kiểm tra ở máy chủ cho từng thao tác (<code>requirePermission</code>), không chỉ ẩn nút trên giao diện.</p></div>
  ${figure("use-case-khach", "Use case phía khách hàng")}
  ${figure("use-case-quan-tri", "Use case khu quản trị theo phân quyền")}
  <h3>Bảng phân quyền (apps/api/src/middleware/permissions.ts)</h3>
  <div class="table-wrap"><table>
    <thead><tr><th>Khu vực</th><th>Chủ website</th><th>Quản lý</th><th>NV đơn hàng</th><th>NV sản phẩm</th></tr></thead>
    <tbody>
      <tr><td>Đơn hàng: xem, xử lý, thanh toán, hoàn tiền</td><td class="yes">✓</td><td class="yes">✓</td><td class="yes">✓</td><td class="nope">–</td></tr>
      <tr><td>Sản phẩm, tồn kho, duyệt đánh giá</td><td class="yes">✓</td><td class="yes">✓</td><td class="nope">–</td><td class="yes">✓</td></tr>
      <tr><td>Khách hàng (khoá / mở khoá)</td><td class="yes">✓</td><td class="yes">✓</td><td class="nope">–</td><td class="nope">–</td></tr>
      <tr><td>Mã giảm giá, banner</td><td class="yes">✓</td><td class="yes">✓</td><td class="nope">–</td><td class="nope">–</td></tr>
      <tr><td>Báo cáo doanh thu, xuất Excel</td><td class="yes">✓</td><td class="yes">✓</td><td class="nope">–</td><td class="nope">–</td></tr>
      <tr><td>Tài khoản quản trị, phân quyền</td><td class="yes">✓</td><td class="nope">–</td><td class="nope">–</td><td class="nope">–</td></tr>
      <tr><td>Cài đặt hệ thống</td><td class="yes">✓</td><td class="nope">–</td><td class="nope">–</td><td class="nope">–</td></tr>
    </tbody>
  </table></div>
</section>

<section id="csdl">
  <h2><span class="num">4</span>Cơ sở dữ liệu</h2>
  <div class="prose">
    <p>Sơ đồ sinh tự động từ <code>packages/db/prisma/schema.prisma</code>: PK khoá chính, FK khoá ngoại, UK duy nhất; nhãn trên đường nối là cột khoá ngoại. Mỗi bảng chỉ hiện khoá và các trường chính. Địa chỉ giao hàng và giá trong đơn là bản chụp tại lúc đặt, không phải khoá ngoại, để đơn cũ không đổi khi khách sửa địa chỉ hay giá bán thay đổi.</p>
  </div>
  ${figure("erd-tong-quat", "ERD tổng quát — 31 bảng (khổ ngang, cuộn để xem hết)", { wide: true })}
  ${figure("erd-san-pham", "Sản phẩm, thông số chuẩn hoá cho Build PC, embedding cho AI và sổ kho")}
  ${figure("erd-nguoi-dung", "Người dùng, đăng nhập mạng xã hội, phiên đăng nhập và nhật ký quản trị")}
  ${figure("erd-don-hang", "Giỏ hàng, đơn hàng, lịch sử trạng thái, thanh toán và mã giảm giá")}
  ${figure("erd-ai-tuong-tac", "Hội thoại AI, cấu hình Build PC, đánh giá, yêu thích, banner và cài đặt")}
</section>

<section id="don-hang">
  <h2><span class="num">5</span>Vòng đời đơn hàng</h2>
  <div class="prose"><p>Nhân viên chỉ chuyển tiến đúng một bước mỗi lần; huỷ và hoàn trả là thao tác riêng, luôn hỏi lý do. Mỗi lần đổi trạng thái ghi vào <code>OrderStatusHistory</code> kèm người thực hiện; khách thấy tiến trình 5 bước có mốc thời gian. Chuyển khoản/MoMo được nhân viên xác nhận khi nhận tiền: đơn đang chờ sẽ tự chuyển sang “Đã xác nhận”.</p></div>
  ${figure("trang-thai-don", "Máy trạng thái của đơn hàng")}
</section>

<section id="luong">
  <h2><span class="num">6</span>Luồng xử lý chính</h2>
  <h3>Đặt hàng: một transaction, không bao giờ có nửa đơn</h3>
  <div class="prose"><p>Tồn kho được trừ bằng câu lệnh có điều kiện (còn đủ hàng mới trừ), nên hai người đặt cùng món cuối cùng thì chỉ một người thành công, người kia nhận thông báo hết hàng.</p></div>
  ${figure("tuan-tu-dat-hang", "Tuần tự: đặt hàng")}
  <h3>AI gợi ý cấu hình: AI chọn, luật kiểm tra</h3>
  <div class="prose"><p>AI chỉ được chọn trong danh mục có mã; mã lạ bị bỏ. Tương thích do 9 luật viết bằng mã kiểm tra (socket, loại RAM, số khe RAM, chuẩn bo mạch và chiều dài card so với vỏ, công suất nguồn, cổng xuất hình, tản nhiệt...). Vượt ngân sách thì hệ thống tự đổi món rẻ hơn bằng thuật toán nhánh cận, không tốn thêm lượt AI.</p></div>
  ${figure("tuan-tu-ai-cau-hinh", "Tuần tự: AI gợi ý cấu hình theo ngân sách")}
  <h3>Trợ lý AI: truy hồi trước, trả lời sau (RAG)</h3>
  <div class="prose"><p>Câu trả lời được stream từng đoạn qua SSE. Sản phẩm trích dẫn do máy chủ tự đối chiếu với danh sách ứng viên, không tin AI tự khai, nên thẻ sản phẩm luôn là hàng có thật và giá lấy từ DB.</p></div>
  ${figure("tuan-tu-tro-ly-ai", "Tuần tự: trợ lý AI tư vấn")}
  <h3>Đăng nhập Google / Facebook</h3>
  <div class="prose"><p>Tài khoản mạng xã hội nhận diện bằng mã cố định của nhà cung cấp, không tự gộp theo email; Facebook trùng email bị từ chối để chống kẻ xấu đăng ký trước bằng email của người khác.</p></div>
  ${figure("tuan-tu-dang-nhap-mxh", "Tuần tự: đăng nhập bằng mạng xã hội (OAuth 2.0)")}
</section>

<section id="chat-luong">
  <h2><span class="num">7</span>Kiểm thử &amp; bảo mật</h2>
  <div class="table-wrap"><table>
    <thead><tr><th>Loại</th><th>Phạm vi</th><th>Lệnh</th></tr></thead>
    <tbody>
      <tr><td>Kiểm thử đơn vị — 465</td><td>Bộ tìm kiếm, ký/xác minh VNPay, mã giảm giá, đánh giá, đọc thông số + 9 luật tương thích, tự điều chỉnh ngân sách, trích dẫn AI, cài đặt hệ thống, chữ ký file ảnh</td><td><code>npm test -w @pczone/api</code></td></tr>
      <tr><td>Đầu-cuối — 56</td><td>17 kịch bản chức năng: trọn vòng đời đơn với 2 trình duyệt (khách + quản trị), cửa hàng, cài đặt, Build PC, phân quyền, SEO/header; cộng 39 lượt kiểm tra truy cập bên dưới</td><td><code>npm run test:e2e</code></td></tr>
      <tr><td>Khả năng truy cập</td><td>axe-core, WCAG 2.1 AA gồm cả độ tương phản màu: 19 trang khách, 7 trang tài khoản, toàn bộ khu quản trị (cả trang sửa/chi tiết) — không lỗi nghiêm trọng nào; không tràn ngang ở màn 375px</td><td>nằm trong <code>test:e2e</code></td></tr>
    </tbody>
  </table></div>
  <h3>Các lớp bảo vệ</h3>
  <ul class="checklist">
    <li>Mật khẩu băm bcrypt; access token 15 phút + refresh token xoay vòng, lưu dạng băm; cookie httpOnly, SameSite=Lax, Secure khi chạy HTTPS.</li>
    <li>Phiên quản trị tách hẳn phiên khách (cookie và issuer JWT riêng), xác thực 2 bước TOTP, nhật ký mọi thao tác quản trị.</li>
    <li>Phân quyền kiểm ở máy chủ cho từng route; khách không đọc được đơn của người khác (đã có test).</li>
    <li>Giới hạn đăng nhập sai và tần suất theo IP thật của khách (<code>TRUST_PROXY</code> khi đứng sau Caddy); chống CSRF bằng kiểm tra Origin.</li>
    <li>Ảnh tải lên được đối chiếu chữ ký đầu file, không tin kiểu MIME tự khai; header chống clickjacking, nosniff, HSTS; không lộ chi tiết lỗi ở production.</li>
  </ul>
</section>

<section id="demo">
  <h2><span class="num">8</span>Kịch bản demo (12–15 phút)</h2>
  <h3>Chuẩn bị trước buổi bảo vệ</h3>
  <ul class="checklist">
    <li>Bật Docker Desktop (MySQL), chạy <code>npm run dev:api</code> và <code>npm run dev:web</code>, hoặc mở bản đã triển khai.</li>
    <li>Gửi thử một câu ở Trợ lý AI để chắc khoá AI còn lượt. Hết lượt thì tắt AI ở trang Cài đặt và trình bày phần tự ráp cấu hình.</li>
    <li>Mở hai trình duyệt: một bên khách đã đăng nhập, một bên khu quản trị. Chuẩn bị sẵn vài đơn ở các trạng thái khác nhau.</li>
    <li>Tạo sẵn một tài khoản vai trò Nhân viên đơn hàng ở trang Tài khoản quản trị, để demo phân quyền.</li>
    <li>Chạy <code>npm run test:e2e</code> trước giờ bảo vệ, mở báo cáo bằng <code>npm run report -w @pczone/e2e</code>.</li>
    <li>Nếu demo trên mạng: đổi mật khẩu tài khoản quản trị mẫu, điền hotline và email thật ở trang Cài đặt.</li>
  </ul>
  <ol class="steps">
    <li><span class="time">1 phút</span><h3>Giới thiệu và kiến trúc</h3><p>Trang chủ với sản phẩm và banner thật; mở Hình 1 để nói luồng dữ liệu.</p><p class="point"><b>Điểm nhấn:</b> một tên miền, HTTPS, tách web / API / CSDL.</p></li>
    <li><span class="time">2 phút</span><h3>Tìm kiếm</h3><p>Gõ không dấu, sai chính tả, kèm mức giá (vd “chuot khong day duoi 2 trieu”), rồi thử câu tự nhiên ở ô tìm kiếm bằng AI.</p><p class="point"><b>Điểm nhấn:</b> bộ tìm từ khoá hiểu không dấu, đồng nghĩa, mức giá; AI tìm theo nghĩa, hết khoá thì tự lùi về tìm từ khoá.</p></li>
    <li><span class="time">2 phút</span><h3>Trợ lý AI</h3><p>Hỏi “laptop cho sinh viên đồ hoạ tầm 25 triệu”.</p><p class="point"><b>Điểm nhấn:</b> chữ hiện dần (SSE); thẻ sản phẩm là hàng có thật do máy chủ tự đối chiếu (Hình 12).</p></li>
    <li><span class="time">2 phút</span><h3>Build PC</h3><p>Chọn CPU rồi một bo mạch sai socket để thấy báo lỗi; sau đó nhờ AI gợi ý “PC chơi game 25 triệu” và mở link chia sẻ.</p><p class="point"><b>Điểm nhấn:</b> AI chọn, luật kiểm tra; vượt ngân sách thì hệ thống tự đổi món (Hình 11).</p></li>
    <li><span class="time">2 phút</span><h3>Mua hàng</h3><p>Thêm vào giỏ, thanh toán với sổ địa chỉ, mã giảm giá WELCOME10, chọn COD hoặc chuyển khoản (hiện mã QR), đặt hàng.</p><p class="point"><b>Điểm nhấn:</b> transaction trừ kho an toàn (Hình 10); phí ship theo Cài đặt.</p></li>
    <li><span class="time">3 phút</span><h3>Quản trị xử lý đơn</h3><p>Tab quản trị: xác nhận, đóng gói, giao kèm mã vận đơn, đã giao. Quay lại tab khách: tiến trình cập nhật; khách viết đánh giá, quản trị duyệt, đánh giá hiện công khai.</p><p class="point"><b>Điểm nhấn:</b> máy trạng thái (Hình 9); chỉ khách đã nhận hàng mới đánh giá được.</p></li>
    <li><span class="time">1 phút</span><h3>Phân quyền và báo cáo</h3><p>Đăng nhập tài khoản nhân viên đơn hàng để thấy menu chỉ còn đơn hàng; xem dashboard doanh thu, xuất Excel; đổi phí ship ở Cài đặt rồi xem giỏ hàng áp dụng ngay.</p><p class="point"><b>Điểm nhấn:</b> quyền kiểm ở máy chủ (Hình 3), xác thực 2 bước, nhật ký thao tác.</p></li>
    <li><span class="time">1 phút</span><h3>Chất lượng và triển khai</h3><p>Mở báo cáo 56 kịch bản đầu-cuối; nói về kiểm thử đơn vị, axe-core và bộ triển khai Docker + HTTPS.</p><p class="point"><b>Điểm nhấn:</b> test chạy trên DB riêng, không đụng dữ liệu thật.</p></li>
  </ol>
</section>

<section id="hoi-dap">
  <h2><span class="num">9</span>Câu hỏi hội đồng hay hỏi</h2>
  <div class="qa">
    <div><b>Làm sao AI không bịa ra sản phẩm?</b><p>Trợ lý chỉ nhận danh sách sản phẩm truy hồi từ DB, máy chủ tự đối chiếu sản phẩm được nhắc. AI gợi ý cấu hình chọn theo mã trong danh mục, mã lạ bị bỏ, tương thích do luật viết bằng mã kiểm tra.</p></div>
    <div><b>Hai người cùng đặt món cuối cùng thì sao?</b><p>Trừ kho trong transaction bằng câu lệnh có điều kiện “tồn ≥ số lượng”. Chỉ một lệnh thành công, người còn lại nhận lỗi 409 “không còn đủ số lượng”.</p></div>
    <div><b>Vì sao không tách dịch vụ AI riêng (Python, vector DB)?</b><p>Với khoảng 436 sản phẩm, tính cosine trên chỉ mục embedding trong bộ nhớ đủ nhanh, bớt một dịch vụ phải vận hành. Truy hồi dùng chung cho tìm kiếm, trợ lý và gợi ý cấu hình.</p></div>
    <div><b>Bảo mật đăng nhập ra sao?</b><p>bcrypt, JWT ngắn hạn + refresh token xoay vòng lưu dạng băm, cookie httpOnly; giới hạn đăng nhập sai; quản trị có phiên riêng và xác thực 2 bước.</p></div>
    <div><b>Đăng nhập Google/Facebook có bị chiếm tài khoản không?</b><p>Không gộp theo email. Facebook không bảo đảm email đã xác minh nên trùng email bị từ chối; người dùng đăng nhập cách cũ rồi tự liên kết.</p></div>
    <div><b>Thanh toán trực tuyến?</b><p>VNPay có đủ mã ký/xác minh và kiểm thử bằng khoá giả, nhưng chưa đăng ký tài khoản sandbox nên đang tắt. Đang dùng COD và chuyển khoản/MoMo qua mã QR, nhân viên xác nhận khi nhận tiền.</p></div>
    <div><b>Kiểm thử thế nào?</b><p>465 kiểm thử đơn vị cho logic thuần; 56 kịch bản đầu-cuối bằng Playwright chạy trình duyệt thật trên API, web và DB riêng, gồm cả kiểm tra khả năng truy cập bằng axe-core.</p></div>
  </div>
</section>

<section id="tinh-trang">
  <h2><span class="num">10</span>Tình trạng &amp; hướng phát triển</h2>
  <div class="status">
    <div>
      <h3><span class="pill ok">Đã chạy thật</span></h3>
      <ul>
        <li>Mua hàng, giỏ, đặt hàng, tra cứu đơn, đánh giá, yêu thích, so sánh</li>
        <li>Quản trị: đơn hàng, sản phẩm, kho, khách hàng, mã giảm giá, banner, báo cáo + Excel, tài khoản quản trị, cài đặt</li>
        <li>Tìm kiếm AI, trợ lý AI, Build PC và AI gợi ý cấu hình (khoá Gemini thật)</li>
        <li>Kiểm thử đơn vị và đầu-cuối; cụm triển khai Docker chạy thử trọn quy trình trên máy dev</li>
      </ul>
    </div>
    <div>
      <h3><span class="pill warn">Có mã, chưa chạy thật</span></h3>
      <ul>
        <li>VNPay: chưa đăng ký sandbox, đang tắt</li>
        <li>Đăng nhập Facebook bằng tài khoản thật: chờ xác nhận</li>
        <li>Chạy trên VPS với tên miền thật: chờ có máy chủ</li>
        <li>Email tới khách thật: cần xác minh tên miền trên Resend</li>
      </ul>
    </div>
    <div>
      <h3><span class="pill no">Chưa làm / hạn chế</span></h3>
      <ul>
        <li>Chưa có nút tự xoá tài khoản (xử lý qua email hỗ trợ)</li>
        <li>Thời hạn đổi trả, thời gian giao chưa chốt con số</li>
        <li>Số serial/IMEI và biên bản kiểm tra máy mới giữ chỗ “Sắp ra mắt”</li>
      </ul>
    </div>
  </div>
  <p class="note">Hướng phát triển: cổng thanh toán thật, đơn vị vận chuyển có API tra cứu, thông báo email theo trạng thái đơn.</p>
</section>
</main>
</div>
`;

fs.writeFileSync(OUT, html);
console.log(`Đã dựng ${OUT} — ${figureNo} hình, ${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB`);
