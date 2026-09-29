// Chờ tới khi một địa chỉ trả 2xx (tối đa 3 phút) — web chỉ build sau khi API kiểm thử đã chạy, để các trang dựng sẵn
// lúc build lấy đúng dữ liệu của DB kiểm thử thay vì dữ liệu dự phòng.
const target = process.argv[2];
const deadline = Date.now() + 180_000;

while (Date.now() < deadline) {
  try {
    const response = await fetch(target);
    if (response.ok) process.exit(0);
  } catch {
    // chưa mở cổng — thử lại
  }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
console.error(`[e2e] Hết thời gian chờ ${target}`);
process.exit(1);
