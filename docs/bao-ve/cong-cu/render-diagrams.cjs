// Vẽ docs/bao-ve/so-do/*.mmd ra .svg + .png (nền trắng, gấp đôi độ phân giải) để chèn vào báo cáo Word / slide
const { createRequire } = require("node:module");
const fs = require("node:fs");
const path = require("node:path");

// Gốc dự án pczone, tính từ vị trí script (docs/bao-ve/cong-cu)
const ROOT = path.resolve(__dirname, "../../..");
const repoRequire = createRequire(path.join(ROOT, "apps/e2e/package.json"));
const { chromium } = repoRequire("@playwright/test");
const DIR = path.join(ROOT, "docs/bao-ve/so-do");
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, "manifest.json"), "utf8"));

(async () => {
  const browser = await chromium.launch({ channel: "msedge" });
  const page = await browser.newPage({ deviceScaleFactor: 2 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8">
    <script type="module">import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs"; import elk from "https://cdn.jsdelivr.net/npm/@mermaid-js/layout-elk@0/dist/mermaid-layout-elk.esm.min.mjs"; mermaid.registerLayoutLoaders(elk); window.mermaid = mermaid;</script></head>
    <body style="margin:0;background:#fff"><div id="stage" style="display:inline-block;padding:24px;background:#fff"></div></body></html>`);
  await page.waitForFunction(() => typeof window.mermaid !== "undefined");
  await page.evaluate(() =>
    window.mermaid.initialize({
      startOnLoad: false,
      theme: "default",
      securityLevel: "strict",
      fontFamily: "Segoe UI, Arial, sans-serif",
      // Chữ vẽ bằng thẻ <text> của SVG (không dùng <foreignObject> HTML) — Word/PowerPoint mới hiển thị được khi chèn SVG
      htmlLabels: false,
      flowchart: { htmlLabels: false, curve: "basis" },
      er: { layoutDirection: "TB" },
      sequence: { mirrorActors: false, wrap: true, width: 170 },
    }),
  );

  const version = await page.evaluate(() => fetch("https://cdn.jsdelivr.net/npm/mermaid@11/package.json").then((r) => r.json()).then((j) => j.version).catch(() => "?"));
  console.log(`Mermaid ${version}`);
  const failures = [];
  for (const { id, title } of manifest) {
    const code = fs.readFileSync(path.join(DIR, `${id}.mmd`), "utf8");
    try {
      const svg = await page.evaluate(async ({ id, code }) => {
        const { svg } = await window.mermaid.render(`d-${id}`, code);
        const stage = document.getElementById("stage");
        stage.innerHTML = svg;
        // Mermaid để width="100%" + max-width: co theo khung chứa. Đặt kích thước thật theo viewBox để ảnh không bị
        // thu nhỏ, và để Word/PowerPoint đọc được đúng kích thước khi chèn file SVG
        const el = stage.querySelector("svg");
        const [, , w, h] = el.getAttribute("viewBox").split(/[\s,]+/).map(Number);
        el.setAttribute("width", String(Math.ceil(w)));
        el.setAttribute("height", String(Math.ceil(h)));
        el.style.maxWidth = "none";
        el.style.backgroundColor = "#ffffff";
        return el.outerHTML;
      }, { id, code });
      fs.writeFileSync(path.join(DIR, `${id}.svg`), svg);
      const stage = page.locator("#stage");
      await stage.screenshot({ path: path.join(DIR, `${id}.png`) });
      const box = await page.locator("#stage svg").boundingBox();
      console.log(`✓ ${id} (${Math.round(box.width)}×${Math.round(box.height)}px) — ${title}`);
    } catch (error) {
      failures.push(id);
      console.log(`✗ ${id}: ${String(error.message || error).split("\n")[0]}`);
    }
  }
  await browser.close();
  if (failures.length) process.exit(1);
})();
