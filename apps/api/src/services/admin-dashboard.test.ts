/**
 * Kiểm thử các hàm THUẦN dựng biểu đồ doanh thu (bucketKeyOf/bucketLabelOf/generateBucketKeys/
 * defaultRangeFor) — không cần DB. Chạy: npx tsx src/services/admin-dashboard.test.ts
 */
import { bucketKeyOf, bucketLabelOf, defaultRangeFor, generateBucketKeys } from "./admin-dashboard.service.js";

let passed = 0;
let failed = 0;

function check(label: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}\n      mong đợi: ${e}\n      nhận được: ${a}`);
    failed++;
  }
}

console.log("\n[1] bucketKeyOf — day/month/year");
{
  const d = new Date(2026, 8, 23); // 23/09/2026
  check("day", bucketKeyOf(d, "day"), "2026-09-23");
  check("month", bucketKeyOf(d, "month"), "2026-09");
  check("year", bucketKeyOf(d, "year"), "2026");
}

console.log("\n[2] bucketKeyOf — week luôn quy về đúng một mốc Thứ Hai cho cả 7 ngày trong tuần");
{
  const keys = new Set<string>();
  for (let i = 0; i < 7; i++) keys.add(bucketKeyOf(new Date(2026, 8, 21 + i), "week"));
  check("7 ngày liên tiếp cùng ra đúng 1 khoá tuần", keys.size, 1);

  const thisWeekKey = [...keys][0];
  const nextWeekKey = bucketKeyOf(new Date(2026, 8, 28), "week");
  check("tuần kế tiếp ra khoá khác", nextWeekKey !== thisWeekKey, true);
  check(
    "khoảng cách giữa hai khoá tuần đúng 7 ngày",
    (new Date(nextWeekKey).getTime() - new Date(thisWeekKey).getTime()) / 86_400_000,
    7,
  );
}

console.log("\n[3] bucketLabelOf");
{
  check("day", bucketLabelOf("2026-09-23", "day"), "23/09");
  check("week", bucketLabelOf("2026-09-21", "week"), "Tuần 21/09");
  check("month", bucketLabelOf("2026-09", "month"), "Th9/2026");
  check("year", bucketLabelOf("2026", "year"), "2026");
}

console.log("\n[4] generateBucketKeys — day");
{
  const keys = generateBucketKeys(new Date(2026, 8, 1), new Date(2026, 8, 5), "day");
  check("1-5/9 ra đúng 5 khoá, đủ đầu-cuối, không trùng", keys, [
    "2026-09-01",
    "2026-09-02",
    "2026-09-03",
    "2026-09-04",
    "2026-09-05",
  ]);
}

console.log("\n[5] generateBucketKeys — month, qua năm mới");
{
  const keys = generateBucketKeys(new Date(2025, 10, 15), new Date(2026, 1, 3), "month");
  check("Th11,12/2025 + Th1,2/2026 = 4 khoá (ngày trong tháng không ảnh hưởng)", keys, [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
  ]);
}

console.log("\n[6] generateBucketKeys — year");
{
  const keys = generateBucketKeys(new Date(2023, 5, 1), new Date(2026, 2, 1), "year");
  check("2023 → 2026 = 4 khoá", keys, ["2023", "2024", "2025", "2026"]);
}

console.log("\n[7] generateBucketKeys — week không bỏ sót tuần đầu dù from không phải Thứ Hai");
{
  const keys = generateBucketKeys(new Date(2026, 8, 23), new Date(2026, 9, 5), "week");
  check("mọi khoá cách nhau đúng 7 ngày, không trùng", new Set(keys).size, keys.length);
  for (const key of keys) {
    check(`"${key}" là một khoá hợp lệ (7 ngày quy về đúng chính nó)`, bucketKeyOf(new Date(key), "week"), key);
  }
}

console.log("\n[8] defaultRangeFor — mỗi mức hiển thị lùi đúng số bước đã định");
{
  const now = new Date(2026, 8, 23); // 23/09/2026

  const day = defaultRangeFor("day", now);
  check("day: 14 ngày gồm cả hôm nay", Math.round((day.to.getTime() - day.from.getTime()) / 86_400_000), 13);

  const week = defaultRangeFor("week", now);
  check("week: 8 tuần", Math.round((week.to.getTime() - week.from.getTime()) / 86_400_000), 49);

  const month = defaultRangeFor("month", now);
  check("month: lùi về đúng 12 tháng trước (kể cả tháng hiện tại)", `${month.from.getFullYear()}-${month.from.getMonth() + 1}`, "2025-10");

  const year = defaultRangeFor("year", now);
  check("year: lùi về đúng 5 năm trước (kể cả năm hiện tại)", year.from.getFullYear(), 2022);

  check("to luôn là thời điểm truyền vào", day.to.getTime(), now.getTime());
}

console.log(`\n${passed} đạt, ${failed} lỗi`);
if (failed > 0) process.exit(1);
