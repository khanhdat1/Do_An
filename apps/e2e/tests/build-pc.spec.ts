import { expect, test } from "@playwright/test";
import { CPU_9700X } from "./helpers";

test("Build PC: không có khoá AI thì báo AI tạm tắt, tự chọn linh kiện vẫn chạy và tính tổng tiền", async ({ page }) => {
  await page.goto("/ai-build-pc");
  await expect(page.getByRole("heading", { name: "AI gợi ý cấu hình đang tạm tắt" })).toBeVisible();

  await page.getByRole("button", { name: "Chọn CPU" }).click();
  const picker = page.getByRole("dialog");
  await expect(picker).toBeVisible();
  await picker.locator("li").filter({ hasText: "9700X" }).getByRole("button", { name: "Chọn", exact: true }).click();
  await expect(picker).toBeHidden();

  const slots = page.getByRole("region", { name: "Linh kiện trong cấu hình" });
  await expect(slots.getByText(CPU_9700X.name)).toBeVisible();
  await expect(slots.getByRole("button", { name: "Bỏ CPU đã chọn" })).toBeVisible();

  const count = page.getByText("1 linh kiện", { exact: true }).filter({ visible: true });
  await expect(count).toBeVisible();
  await expect(count.locator("xpath=..")).toContainText(CPU_9700X.price);
});
