// danh-gia-ai.mjs (ban 2) — chạy bộ câu hỏi đánh giá AI (Phụ lục C) qua API PCZone đang chạy trên máy, ghi kết quả ra CSV.
//
//   node danh-gia-ai.mjs cau-hoi.csv                 (API mặc định http://localhost:4000)
//   node danh-gia-ai.mjs cau-hoi.csv --api=http://localhost:4000 --delay=5000
//
// Không cần cài thêm thư viện (Node >= 20). Đọc cau-hoi.csv (cột: ma, loai, nhom, cau_hoi, ky_vong), gọi:
//   loai = search : GET /api/ai/search (AI) và GET /api/search (từ khoá, đối chứng), lấy 5 kết quả đầu mỗi bên
//   loai = chat   : POST /api/ai/chat, đọc luồng SSE tới khi xong
//   loai = build  : POST /api/ai/build
// Kết quả: ket-qua-danh-gia.csv (mở bằng Excel) + ket-qua-danh-gia.json (bản thô) + tong-ket.txt.
//
// CÁCH CHẤM TỰ ĐỘNG (cùng một luật cho AI và từ khoá)
//   ky_vong (chỉ cho search): các sản phẩm đúng, cách nhau dấu |. Mỗi mục là slug sản phẩm HOẶC một đoạn tên
//   (so không dấu, không phân biệt hoa thường). Một kết quả là "đúng" khi khớp ít nhất một mục.
//   Hit@5       = 1 nếu có ít nhất 1 kết quả đúng trong 5 kết quả đầu, ngược lại 0.
//   Precision@5 = (số kết quả đúng trong 5 kết quả đầu) / 5  (mẫu số luôn là 5, kể cả khi trả ít hơn 5).
// ĐO THỜI GIAN (phía máy chạy script, tính bằng ms, chỉ lượt thành công cuối cùng)
//   search: ai_ms (tìm AI), tk_ms (tìm từ khoá)
//   chat  : tg_khung_dau_ms = tới khung SSE đầu tiên ("meta", gửi sau bước truy hồi sản phẩm, chưa có chữ)
//           tg_chu_dau_ms   = tới đoạn chữ đầu tiên của câu trả lời; thoi_gian_ms = tới khi trả lời xong
//   build : thoi_gian_ms = tổng thời gian một yêu cầu
//   p95 dùng cách "hạng gần nhất": giá trị thứ ceil(0.95 × n) sau khi sắp xếp tăng dần.
// THỬ LẠI: chỉ khi API báo 429 (giới hạn lượt của chính API) hoặc 503 "Dịch vụ AI hiện không phản hồi được"
//   (Gemini lỗi/hết hạn mức sau khi API đã tự thử lại). KHÔNG thử lại mọi trường hợp khác — kể cả 503
//   "AI chưa đưa ra được cấu hình hợp lệ" và lỗi 500 — vì đó là KẾT QUẢ cần chấm. Số lần thử ghi ở cột so_lan_thu.

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const inputFile = args.find((a) => !a.startsWith("--"));
const opt = (name, fallback) => args.find((a) => a.startsWith(`--${name}=`))?.split("=").slice(1).join("=") ?? fallback;
const API = opt("api", "http://localhost:4000").replace(/\/+$/, "");
const DELAY_MS = Number(opt("delay", "5000"));
const RETRY_WAIT_MS = Number(opt("retry-wait", "30000"));
const MAX_ATTEMPTS = 3;
const TOP_K = 5;
const INFRA_503 = "không phản hồi được";

if (!inputFile) {
  console.error("Cach dung: node danh-gia-ai.mjs cau-hoi.csv [--api=http://localhost:4000] [--delay=5000]");
  process.exit(1);
}

/* ---------------------------------------------------------------- CSV */

function detectDelimiter(headerLine) {
  return (headerLine.match(/;/g) ?? []).length > (headerLine.match(/,/g) ?? []).length ? ";" : ",";
}

function parseCsv(text, delimiter) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') inQuotes = false;
      else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === delimiter) { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

function toCsv(rows, delimiter) {
  const esc = (value) => {
    const s = value === null || value === undefined ? "" : String(value);
    return /["\r\n]/.test(s) || s.includes(delimiter) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(delimiter)).join("\r\n") + "\r\n";
}

/* ---------------------------------------------------------------- tiện ích */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function norm(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d").replace(/Đ/g, "D")
    .toLowerCase().replace(/\s+/g, " ").trim();
}

function expectedList(text) {
  return String(text ?? "").split("|").map(norm).filter(Boolean);
}

/** Chấm 5 kết quả đầu: trả { hit, precision } hoặc rỗng nếu câu không có ky_vong */
function grade(expectedText, products) {
  const expected = expectedList(expectedText);
  if (expected.length === 0) return { hit: "", precision: "" };
  const top = products.slice(0, TOP_K);
  const relevant = top.filter((p) => expected.some((e) => norm(p.slug) === e || norm(p.name).includes(e))).length;
  return { hit: relevant > 0 ? 1 : 0, precision: Number((relevant / TOP_K).toFixed(2)) };
}

function stats(values) {
  const v = values.filter((x) => typeof x === "number" && Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mean = v.reduce((s, x) => s + x, 0) / v.length;
  const p95 = v[Math.max(0, Math.ceil(0.95 * v.length) - 1)];
  return { n: v.length, mean: Math.round(mean), p95, max: v[v.length - 1] };
}
const fmtStats = (s) => (s ? `TB ${s.mean} ms, p95 ${s.p95} ms (n = ${s.n}, max ${s.max} ms)` : "khong co so lieu");

/**
 * Gọi API. Chỉ thử lại khi 429, khi 503 do dịch vụ AI không phản hồi (hạn mức/quá tải), hoặc khi mất kết nối.
 * Trả { res, started, attempts, bodyText? } — bodyText có khi đã phải đọc thân response để quyết định.
 */
async function request(url, init = {}) {
  for (let attempt = 1; ; attempt++) {
    const started = Date.now();
    let res;
    try {
      res = await fetch(url, init);
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw new Error(`khong ket noi duoc ${url}: ${error.message}`);
      console.log(`   ! loi ket noi, thu lai sau ${RETRY_WAIT_MS / 1000} giay (lan ${attempt})`);
      await sleep(RETRY_WAIT_MS);
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      const bodyText = await res.text();
      const retryable = res.status === 429 || bodyText.includes(INFRA_503);
      if (retryable && attempt < MAX_ATTEMPTS) {
        console.log(`   ! HTTP ${res.status} (han muc / dich vu AI ban), thu lai sau ${RETRY_WAIT_MS / 1000} giay (lan ${attempt})`);
        await sleep(RETRY_WAIT_MS);
        continue;
      }
      return { res, started, attempts: attempt, bodyText };
    }
    return { res, started, attempts: attempt };
  }
}

function parseJson(text) {
  try { return JSON.parse(text); } catch { return { raw: String(text).slice(0, 300) }; }
}
async function readJson(r) {
  return parseJson(r.bodyText ?? (await r.res.text()));
}
const errText = (status, body) => `HTTP ${status}: ${body.message ?? body.error ?? body.raw ?? ""}`;
const productLabel = (p) => `${p.name}${p.price ? ` (${Number(p.price).toLocaleString("vi-VN")}d)` : ""}`;

/* ---------------------------------------------------------------- 3 loại câu */

async function runSearch(q, expected) {
  const out = {};
  const ai = await request(`${API}/api/ai/search?q=${encodeURIComponent(q)}`);
  const aiBody = await readJson(ai);
  out.ai_ms = Date.now() - ai.started;
  out.thoi_gian_ms = out.ai_ms;
  out.http_status = ai.res.status;
  out.so_lan_thu = ai.attempts;
  if (!ai.res.ok) out.loi = `AI search ${errText(ai.res.status, aiBody)}`;
  const aiItems = Array.isArray(aiBody.items) ? aiBody.items : [];
  out.ai_dung_ai = aiBody.usedAi === true ? 1 : 0;
  out.ai_top5 = aiItems.slice(0, TOP_K).map((p) => p.name).join(" | ");
  out.ai_top5_slug = aiItems.slice(0, TOP_K).map((p) => p.slug).join(" | ");
  ({ hit: out.ai_hit5, precision: out.ai_p5 } = grade(expected, aiItems));

  const kw = await request(`${API}/api/search?q=${encodeURIComponent(q)}&pageSize=${TOP_K}`);
  const kwBody = await readJson(kw);
  out.tk_ms = Date.now() - kw.started;
  const kwItems = Array.isArray(kwBody.items) ? kwBody.items : [];
  out.tk_top5 = kwItems.slice(0, TOP_K).map((p) => p.name).join(" | ");
  out.tk_top5_slug = kwItems.slice(0, TOP_K).map((p) => p.slug).join(" | ");
  ({ hit: out.tk_hit5, precision: out.tk_p5 } = grade(expected, kwItems));
  out.tk_tong = kwBody.total ?? "";
  if (!kw.res.ok) out.loi = [out.loi, `tu khoa ${errText(kw.res.status, kwBody)}`].filter(Boolean).join("; ");
  return { out, raw: { ai: aiBody, keyword: kwBody } };
}

async function runChat(message) {
  const out = {};
  const r = await request(`${API}/api/ai/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
    body: JSON.stringify({ message }),
  });
  out.http_status = r.res.status;
  out.so_lan_thu = r.attempts;
  if (!r.res.ok) {
    const body = await readJson(r);
    out.thoi_gian_ms = Date.now() - r.started;
    out.loi = errText(r.res.status, body);
    return { out, raw: body };
  }
  const decoder = new TextDecoder();
  const reader = r.res.body.getReader();
  let buffer = "";
  let text = "";
  let done = null;
  let streamError = null;
  for (;;) {
    const { value, done: finished } = await reader.read();
    if (finished) break;
    buffer += decoder.decode(value, { stream: true });
    let cut;
    while ((cut = buffer.indexOf("\n\n")) >= 0) {
      const frame = buffer.slice(0, cut);
      buffer = buffer.slice(cut + 2);
      const data = frame.split("\n").filter((l) => l.startsWith("data:")).map((l) => l.slice(5).trim()).join("");
      if (!data) continue;
      let event;
      try { event = JSON.parse(data); } catch { continue; }
      if (out.tg_khung_dau_ms === undefined) out.tg_khung_dau_ms = Date.now() - r.started;
      if (event.type === "chunk") {
        if (out.tg_chu_dau_ms === undefined && event.text) out.tg_chu_dau_ms = Date.now() - r.started;
        text += event.text;
      } else if (event.type === "done") done = event;
      else if (event.type === "error") streamError = event.message;
    }
  }
  out.thoi_gian_ms = Date.now() - r.started;
  out.tra_loi = text.trim();
  const cited = done?.citedProducts ?? [];
  out.so_trich_dan = done ? cited.length : "";
  out.trich_dan = cited.map(productLabel).join(" | ");
  if (streamError) out.loi = `loi giua luong: ${streamError}`;
  else if (!done) out.loi = "luong tra loi ket thuc truoc khi xong";
  return { out, raw: { text, done, streamError } };
}

async function runBuild(prompt) {
  const out = {};
  const r = await request(`${API}/api/ai/build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });
  const body = await readJson(r);
  out.thoi_gian_ms = Date.now() - r.started;
  out.http_status = r.res.status;
  out.so_lan_thu = r.attempts;
  if (!r.res.ok) {
    out.loi = errText(r.res.status, body);
    return { out, raw: body };
  }
  const budget = body.understood?.budget ?? null;
  const total = body.build?.totalAtSave ?? null;
  const items = Array.isArray(body.build?.items) ? body.build.items : [];
  out.ngan_sach_ai_hieu = budget ?? "";
  out.muc_dich_ai_hieu = body.understood?.purpose ?? "";
  out.repair = body.repair ?? "";
  out.lan_dau_dat = body.repair === "NOT_NEEDED" ? 1 : 0;
  out.budget_fit = body.budgetFit?.status ?? "";
  out.so_mon_doi = Array.isArray(body.budgetFit?.swaps) ? body.budgetFit.swaps.length : "";
  out.so_ma_bi_bo = body.droppedCount ?? "";
  out.so_loai_linh_kien = new Set(items.map((i) => i.slot)).size;
  out.tong_tien = total ?? "";
  out.hop_le_cuoi = body.build?.isValidAtSave === true ? 1 : body.build ? 0 : "";
  out.trong_ngan_sach = budget === null || total === null ? "" : total <= budget ? 1 : 0;
  out.ma_cau_hinh = body.build?.code ?? "";
  return { out, raw: body };
}

/* ---------------------------------------------------------------- chạy */

const COLUMNS = [
  "ma", "loai", "nhom", "cau_hoi", "ky_vong", "http_status", "so_lan_thu", "thoi_gian_ms", "loi",
  "ai_dung_ai", "ai_ms", "ai_top5", "ai_top5_slug", "ai_hit5", "ai_p5",
  "tk_ms", "tk_top5", "tk_top5_slug", "tk_hit5", "tk_p5", "tk_tong",
  "tg_khung_dau_ms", "tg_chu_dau_ms", "tra_loi", "so_trich_dan", "trich_dan",
  "ngan_sach_ai_hieu", "muc_dich_ai_hieu", "repair", "lan_dau_dat", "budget_fit", "so_mon_doi", "so_ma_bi_bo",
  "so_loai_linh_kien", "tong_tien", "hop_le_cuoi", "trong_ngan_sach", "ma_cau_hinh",
  "cham_tay_dung", "ghi_chu",
];

const rawText = fs.readFileSync(inputFile, "utf8").replace(/^﻿/, "");
const delimiter = detectDelimiter(rawText.split(/\r?\n/)[0] ?? "");
const [header, ...dataRows] = parseCsv(rawText, delimiter);
const idx = Object.fromEntries(header.map((h, i) => [norm(h), i]));
for (const col of ["ma", "loai", "cau_hoi"]) {
  if (!(col in idx)) {
    console.error(`Thieu cot "${col}" o dong dau cua ${inputFile}. Can co: ma, loai, nhom, cau_hoi, ky_vong`);
    process.exit(1);
  }
}
const get = (row, col) => (col in idx ? (row[idx[col]] ?? "").trim() : "");

try {
  const health = await fetch(`${API}/health`);
  if (!health.ok) throw new Error(`HTTP ${health.status}`);
} catch (error) {
  console.error(`Khong goi duoc ${API}/health (${error.message}). Hay bat API truoc: npm run dev:api`);
  process.exit(1);
}

const startedAt = new Date();
console.log(`Bat dau: ${startedAt.toLocaleString("vi-VN")} — ${dataRows.length} cau, API ${API}, nghi ${DELAY_MS} ms giua cac cau`);

const results = [];
const rawLog = [];
for (const [i, row] of dataRows.entries()) {
  const base = { ma: get(row, "ma"), loai: get(row, "loai").toLowerCase(), nhom: get(row, "nhom"), cau_hoi: get(row, "cau_hoi"), ky_vong: get(row, "ky_vong") };
  process.stdout.write(`[${i + 1}/${dataRows.length}] ${base.ma} (${base.loai}) ... `);
  let r;
  try {
    if (base.loai === "search") r = await runSearch(base.cau_hoi, base.ky_vong);
    else if (base.loai === "chat") r = await runChat(base.cau_hoi);
    else if (base.loai === "build") r = await runBuild(base.cau_hoi);
    else r = { out: { loi: `loai "${base.loai}" khong hop le (chi nhan search, chat, build)` }, raw: null };
  } catch (error) {
    r = { out: { loi: error.message }, raw: null };
  }
  const merged = { ...base, ...r.out };
  results.push(merged);
  rawLog.push({ ...base, ketQua: r.raw });
  console.log(merged.loi ? `LOI: ${merged.loi}` : `xong (${merged.thoi_gian_ms} ms)`);
  fs.writeFileSync("ket-qua-danh-gia.csv", toCsv([COLUMNS, ...results.map((x) => COLUMNS.map((c) => x[c]))], delimiter));
  fs.writeFileSync("ket-qua-danh-gia.json", JSON.stringify(rawLog, null, 2));
  if (i < dataRows.length - 1) await sleep(DELAY_MS);
}
const endedAt = new Date();

/* ---------------------------------------------------------------- tổng kết */

const count = (list, pred) => list.filter(pred).length;
const mean2 = (list, key) => {
  const v = list.map((x) => x[key]).filter((x) => typeof x === "number");
  return v.length ? (v.reduce((s, x) => s + x, 0) / v.length).toFixed(2) : "-";
};
const groupsOf = (list) => [...new Set(list.map((x) => x.nhom || "(khong nhom)"))];
const inGroup = (list, g) => list.filter((x) => (x.nhom || "(khong nhom)") === g);

const lines = [];
lines.push(`Chay tu ${startedAt.toLocaleString("vi-VN")} den ${endedAt.toLocaleString("vi-VN")} (gio may), API ${API}`);
lines.push(`So cau co loi (xem cot "loi"): ${count(results, (x) => x.loi)}. Tong so lan phai thu lai do han muc/dich vu AI ban: ${results.reduce((s, x) => s + Math.max(0, (Number(x.so_lan_thu) || 1) - 1), 0)}`);
lines.push(`p95 tinh theo hang gan nhat; voi n nho (10-20), p95 gan bang hoac bang gia tri lon nhat.`);

const search = results.filter((x) => x.loai === "search");
if (search.length) {
  const graded = search.filter((x) => x.ai_hit5 !== "" && !x.loi);
  lines.push("", `TIM KIEM: ${search.length} cau, ${graded.length} cau co ky_vong va khong loi`);
  lines.push(`  Hit@5       AI ${count(graded, (x) => x.ai_hit5 === 1)}/${graded.length}   | tu khoa ${count(graded, (x) => x.tk_hit5 === 1)}/${graded.length}`);
  lines.push(`  Precision@5 AI ${mean2(graded, "ai_p5")}   | tu khoa ${mean2(graded, "tk_p5")}   (trung binh, P@5 = so ket qua dung trong 5 dau / 5)`);
  lines.push(`  Do tre AI     : ${fmtStats(stats(search.filter((x) => x.http_status === 200).map((x) => x.ai_ms)))}`);
  lines.push(`  Do tre tu khoa: ${fmtStats(stats(search.filter((x) => !x.loi).map((x) => x.tk_ms)))}`);
  const noAi = search.filter((x) => x.ai_dung_ai === 0);
  lines.push(`  AI khong tra ket qua (usedAi = 0): ${noAi.length}${noAi.length ? ` — ${noAi.map((x) => x.ma).join(", ")} (xem log API luc do: loi goi AI hay that su khong co ket qua)` : ""}`);
  for (const g of groupsOf(graded)) {
    const list = inGroup(graded, g);
    lines.push(`  - nhom "${g}" (${list.length} cau): Hit@5 AI ${count(list, (x) => x.ai_hit5 === 1)}/${list.length}, tu khoa ${count(list, (x) => x.tk_hit5 === 1)}/${list.length}; P@5 AI ${mean2(list, "ai_p5")}, tu khoa ${mean2(list, "tk_p5")}`);
  }
}

const chat = results.filter((x) => x.loai === "chat");
if (chat.length) {
  const ok = chat.filter((x) => !x.loi);
  lines.push("", `TRO LY: ${chat.length} cau, ${ok.length} cau tra loi tron ven`);
  lines.push(`  Toi khung SSE dau tien (meta, chua co chu): ${fmtStats(stats(ok.map((x) => x.tg_khung_dau_ms)))}`);
  lines.push(`  Toi doan chu dau tien cua cau tra loi   : ${fmtStats(stats(ok.map((x) => x.tg_chu_dau_ms)))}`);
  lines.push(`  Toi khi tra loi xong                    : ${fmtStats(stats(ok.map((x) => x.thoi_gian_ms)))}`);
  lines.push(`  Co trich dan san pham: ${count(ok, (x) => Number(x.so_trich_dan) > 0)}/${ok.length}; tong so san pham duoc trich dan: ${ok.reduce((s, x) => s + (Number(x.so_trich_dan) || 0), 0)}`);
  for (const g of groupsOf(chat)) lines.push(`  - nhom "${g}": ${inGroup(chat, g).length} cau`);
  lines.push(`  Phan dung/sai gia - thong so, va cau bay tu choi dung hay khong: cham tay o cot cham_tay_dung`);
}

const build = results.filter((x) => x.loai === "build");
if (build.length) {
  const describe = (list, label) => {
    const ok = list.filter((x) => !x.loi);
    const withBudget = ok.filter((x) => x.trong_ngan_sach !== "");
    const out = [`${label}: ${list.length} cau, ${ok.length} cau tra ve cau hinh`];
    const statuses = [...new Set(list.map((x) => x.http_status))].map((s) => `${s} x${count(list, (x) => x.http_status === s)}`).join(", ");
    out.push(`    Ma HTTP: ${statuses}`);
    if (ok.length) {
      out.push(`    Khong co van de ngay lan dau (repair = NOT_NEEDED): ${count(ok, (x) => x.repair === "NOT_NEEDED")}/${ok.length}`);
      out.push(`    Phai sua 1 lan: REPAIRED ${count(ok, (x) => x.repair === "REPAIRED")} (it van de hon, CHUA chac het loi), FAILED ${count(ok, (x) => x.repair === "FAILED")}`);
      out.push(`    Hop le o ket qua cuoi (isValidAtSave, sau ca buoc sua va buoc dieu chinh ngan sach): ${count(ok, (x) => x.hop_le_cuoi === 1)}/${ok.length}`);
      out.push(`    Trong ngan sach o ket qua cuoi: ${count(withBudget, (x) => x.trong_ngan_sach === 1)}/${withBudget.length} (chi tinh cau AI hieu duoc ngan sach)`);
      out.push(`    Buoc dieu chinh ngan sach: FITTED ${count(ok, (x) => x.budget_fit === "FITTED")}, NOT_POSSIBLE ${count(ok, (x) => x.budget_fit === "NOT_POSSIBLE")}`);
      out.push(`    So ma AI dua ra bi bo (khong co trong kho/sai loai): trung binh ${mean2(ok, "so_ma_bi_bo")} moi lan`);
      out.push(`    Du 7 loai linh kien: ${count(ok, (x) => x.so_loai_linh_kien === 7)}/${ok.length}`);
    }
    if (ok.length) out.push(`    Thoi gian xu ly (cau tra ve cau hinh): ${fmtStats(stats(ok.map((x) => x.thoi_gian_ms)))}`);
    for (const x of list.filter((y) => y.loi)) out.push(`    ${x.ma}: HTTP ${x.http_status ?? "?"} sau ${x.thoi_gian_ms ?? "?"} ms — ${x.loi}`);
    return out;
  };
  lines.push("", ...describe(build, "GOI Y CAU HINH - tat ca"));
  for (const g of groupsOf(build)) lines.push(...describe(inGroup(build, g), `  - nhom "${g}"`));
}

const summary = lines.join("\n");
fs.writeFileSync("tong-ket.txt", "﻿" + summary + "\n");
console.log("\n" + summary);
console.log(`\nDa ghi: ${path.resolve("ket-qua-danh-gia.csv")}, ket-qua-danh-gia.json, tong-ket.txt`);
