import { expect, test, type Locator, type Page } from "@playwright/test";
import { seriousViolations } from "./helpers";

/**
 * Bộ lọc thông số kỹ thuật ở trang danh mục, trên 3 laptop gaming của seed:
 *   ASUS TUF A15  — AMD Ryzen 7, RTX 4060, 16 GB, 512 GB
 *   ASUS ROG G16  — Intel Core i9, RTX 4070, 32 GB, 1 TB
 *   Legion Pro 7i — Intel Core i9, RTX 4080, 32 GB, 1 TB
 */
const TUF = "laptop-asus-tuf-gaming-a15-fa507nv";
const ROG = "laptop-asus-rog-strix-g16-g614jir";
const LEGION = "laptop-lenovo-legion-pro-7i-gen-9";
const CATEGORY = "/danh-muc/laptop-gaming";

const productLink = (page: Page, slug: string) => page.locator(`a[href="/san-pham/${slug}"]`).first();

/** Một nhóm lọc trong cột lọc (desktop) hoặc ngăn kéo lọc (điện thoại) */
const filterGroup = (scope: Locator, title: string) =>
  scope.locator("section").filter({ has: scope.page().getByRole("heading", { name: title, exact: true }) });

async function expectOnly(page: Page, visible: string[], hidden: string[]) {
  for (const slug of visible) await expect(productLink(page, slug)).toBeVisible();
  for (const slug of hidden) await expect(page.locator(`a[href="/san-pham/${slug}"]`)).toHaveCount(0);
}

test.describe("Trang danh mục — lọc theo thông số kỹ thuật", () => {
  test("chọn hãng CPU thu hẹp danh sách, con số các nhóm khác cập nhật, bỏ lọc bằng chip", async ({ page }) => {
    await page.goto(CATEGORY);
    await expect(page.getByText("3 sản phẩm", { exact: true })).toBeVisible();

    const panel = page.locator("aside").filter({ has: page.getByText("Bộ lọc", { exact: true }) });
    for (const title of ["Hãng CPU", "Dòng CPU", "RAM", "Card đồ họa", "Ổ cứng"]) {
      await expect(filterGroup(panel, title), `nhóm "${title}"`).toBeVisible();
    }

    // Ô chọn phản ánh URL: chỉ tích sau khi trang lọc xong, nên bấm (click) rồi chờ, không dùng check()
    const amd = filterGroup(panel, "Hãng CPU").getByRole("checkbox", { name: /^AMD\s*1$/ });
    await expect(amd).not.toBeChecked();
    await amd.click();

    await expect(page).toHaveURL(/[?&]cpuBrand=amd(&|$)/);
    await expect(amd).toBeChecked();
    await expect(page.getByText("1 sản phẩm", { exact: true })).toBeVisible();
    await expectOnly(page, [TUF], [ROG, LEGION]);
    await expect(page.getByRole("button", { name: /^Hãng CPU: AMD/ })).toBeVisible();

    // Nhóm khác đếm trong máy AMD: không còn máy 32 GB nào nên lựa chọn bị khoá; trong nhóm đang chọn vẫn đếm đủ (HOẶC)
    await expect(filterGroup(panel, "RAM").getByRole("checkbox", { name: /^32 GB\s*0$/ })).toBeDisabled();
    await expect(filterGroup(panel, "Hãng CPU").getByRole("checkbox", { name: /^Intel\s*2$/ })).toBeEnabled();
    expect(await seriousViolations(page)).toEqual([]);

    // Thêm Intel (cùng nhóm = HOẶC) rồi lọc card RTX 4070 (nhóm khác = VÀ)
    await filterGroup(panel, "Hãng CPU").getByRole("checkbox", { name: /^Intel/ }).click();
    await expect(page).toHaveURL(/cpuBrand=amd%2Cintel|cpuBrand=amd,intel/);
    await expect(page.getByText("3 sản phẩm", { exact: true })).toBeVisible();
    await filterGroup(panel, "Card đồ họa").getByRole("checkbox", { name: /^GeForce RTX 4070\s*1$/ }).click();
    await expect(page).toHaveURL(/[?&]gpu=rtx-4070(&|$)/);
    await expect(page.getByText("1 sản phẩm", { exact: true })).toBeVisible();
    await expectOnly(page, [ROG], [TUF, LEGION]);

    // Tải lại trang: bộ lọc nằm trên URL nên vẫn còn
    await page.reload();
    await expect(filterGroup(panel, "Card đồ họa").getByRole("checkbox", { name: /^GeForce RTX 4070/ })).toBeChecked();
    await expectOnly(page, [ROG], [TUF, LEGION]);

    await page.getByRole("button", { name: /^Card đồ họa: GeForce RTX 4070/ }).click();
    await expect(page).not.toHaveURL(/gpu=/);
    await expect(page.getByText("3 sản phẩm", { exact: true })).toBeVisible();

    await panel.getByRole("button", { name: /^Xóa lọc/ }).click();
    await expect(page).toHaveURL(new RegExp(`${CATEGORY}$`));
    await expect(panel.getByRole("checkbox", { checked: true })).toHaveCount(0);
  });

  test("điện thoại: chọn card đồ họa trong ngăn kéo lọc, nút xem kết quả báo đúng số", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto(CATEGORY);

    await page.getByRole("button", { name: /^Bộ lọc/ }).click();
    const drawer = page.getByRole("dialog", { name: "Bộ lọc sản phẩm" });
    await expect(drawer).toBeVisible();

    await filterGroup(drawer, "Card đồ họa").getByRole("checkbox", { name: /^GeForce RTX 4080/ }).click();
    await expect(page).toHaveURL(/[?&]gpu=rtx-4080(&|$)/);
    // Ngăn kéo vẫn mở để chọn tiếp; nút cuối báo số kết quả mới
    await expect(drawer.getByRole("button", { name: "Xem 1 sản phẩm" })).toBeVisible();
    expect(await seriousViolations(page)).toEqual([]);

    await drawer.getByRole("button", { name: "Xem 1 sản phẩm" }).click();
    await expect(drawer).toBeHidden();
    await expectOnly(page, [LEGION], [TUF, ROG]);
  });

  test("API: chỉ đưa ra nhóm đủ dữ liệu, lọc linh kiện theo ProductSpec, kiểm tra tham số", async ({ request }) => {
    const facets = (await (await request.get("/api/products/facets?category=laptop-gaming")).json()) as {
      groups: { key: string; options: { value: string; count: number }[] }[];
    };
    expect(facets.groups.map((group) => group.key)).toEqual(["cpuBrand", "cpuLine", "ram", "gpu", "storage"]);
    expect(facets.groups.find((group) => group.key === "storage")?.options).toEqual([
      { value: "512", label: "500/512 GB", count: 1 },
      { value: "1000", label: "1 TB", count: 2 },
    ]);

    const list = async (query: string) => ((await (await request.get(`/api/products?${query}`)).json()) as { total: number }).total;
    expect(await list("category=laptop-gaming&cpuLine=core-i9&ram=32")).toBe(2);
    expect(await list("category=laptop-gaming&cpuLine=core-i9&ram=16")).toBe(0);

    // Hai CPU của seed cùng socket AM5: một giá trị thì lọc vô nghĩa, không đưa ra nhóm — nhưng lọc theo ProductSpec vẫn đúng
    expect(((await (await request.get("/api/products/facets?category=cpu")).json()) as { groups: unknown[] }).groups).toEqual([]);
    expect(await list("category=cpu&socket=AM5")).toBe(2);
    expect(await list("category=cpu&socket=LGA1851")).toBe(0);
    expect(await list("category=vga&vram=16")).toBe(2);
    // Nhóm không thuộc loại hàng của danh mục bị bỏ qua thay vì làm danh sách rỗng
    expect(await list("category=laptop-gaming&socket=AM5")).toBe(3);

    const bad = await request.get("/api/products?category=cpu&socket=%3Cscript%3E");
    expect(bad.status()).toBe(400);
  });
});
