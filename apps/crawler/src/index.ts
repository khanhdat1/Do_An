import { categories } from "./config.js";
import { crawlAll, crawlCategory } from "./crawler.js";
import { getHtml } from "./http.js";
import { parseProduct } from "./parser.js";
import { prisma, upsertProduct } from "./db.js";

function getArg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const command = process.argv[2] ?? "crawl";

  if (command === "single") {
    const url = getArg("url") ?? "https://kccshop.vn/mainboard-asrock-b760m-pro-rs-ddr5/";
    const categorySlug = getArg("category") ?? "mainboard";
    const category = categories.find((c) => c.slug === categorySlug);
    if (!category) throw new Error(`Category không hợp lệ: ${categorySlug}`);

    const html = await getHtml(url);
    const product = parseProduct(html, url, category);
    console.log(JSON.stringify(product, null, 2));

    if (getArg("save") !== "false") {
      await upsertProduct(product);
      console.log("✓ Đã lưu vào PostgreSQL.");
    }
    return;
  }

  if (command === "category") {
    const slug = getArg("category") ?? "mainboard";
    const category = categories.find((c) => c.slug === slug);
    if (!category) throw new Error(`Category không hợp lệ: ${slug}`);
    const max = Number(getArg("max") ?? "20");
    console.table([await crawlCategory(category, max)]);
    return;
  }

  console.table(await crawlAll());
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
