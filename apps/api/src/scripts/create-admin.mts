/**
 * Tạo (hoặc đổi mật khẩu/role) một tài khoản quản trị — cách AN TOÀN DUY NHẤT để có tài khoản admin
 * đầu tiên: KHÔNG có endpoint công khai nào tạo được tài khoản role khác CUSTOMER.
 *
 * Chạy từ thư mục apps/api:
 *   npx tsx src/scripts/create-admin.mts --email=owner@pczone.vn --password="MatKhauManh123" \
 *     --name="Chủ website" --role=OWNER
 *
 * --role nhận: OWNER | MANAGER | ORDER_STAFF | PRODUCT_STAFF (mặc định OWNER).
 * Email đã tồn tại thì cập nhật mật khẩu + role + tên (không tạo trùng); dùng lại được để đổi mật
 * khẩu cho tài khoản admin bất kỳ khi cần, không chỉ lúc tạo lần đầu.
 */
import { config } from "dotenv";
config({ path: "../../.env" });

function parseArgs(): { email: string; password: string; name: string; role: string } {
  const args = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = /^--([a-z]+)=(.*)$/.exec(arg);
    if (match) args.set(match[1], match[2]);
  }

  const email = args.get("email")?.trim().toLowerCase();
  const password = args.get("password");
  const name = args.get("name")?.trim() || "Quản trị viên";
  const role = args.get("role")?.trim().toUpperCase() || "OWNER";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    console.error("✗ Thiếu hoặc sai --email=...");
    process.exit(1);
  }
  if (!password || password.length < 8) {
    console.error("✗ --password=... phải có ít nhất 8 ký tự");
    process.exit(1);
  }
  if (!["OWNER", "MANAGER", "ORDER_STAFF", "PRODUCT_STAFF"].includes(role)) {
    console.error("✗ --role phải là OWNER | MANAGER | ORDER_STAFF | PRODUCT_STAFF");
    process.exit(1);
  }

  return { email, password, name, role };
}

const { email, password, name, role } = parseArgs();

const bcrypt = await import("bcryptjs");
const { BCRYPT_COST } = await import("../services/auth.service.js");
const { prisma, UserRole } = await import("@pczone/db");

const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

const user = await prisma.user.upsert({
  where: { email },
  update: { passwordHash, fullName: name, role: role as InstanceType<typeof UserRole>, isActive: true },
  create: { email, passwordHash, fullName: name, role: role as InstanceType<typeof UserRole> },
});

console.log(`✓ Tài khoản quản trị sẵn sàng: ${user.email} — vai trò ${user.role}`);
console.log("  Đăng nhập tại /admin/login. Nên bật 2FA (biểu tượng tài khoản trong trang quản trị) ngay sau khi vào lần đầu.");

await prisma.$disconnect();
