#!/usr/bin/env bash
# Đóng gói dữ liệu của máy dev để chuyển lên máy chủ (README mục 14):
#   bản sao DB `pczone` từ container MySQL dev + ảnh sản phẩm + banner quản trị đã tải lên
#   → deploy/data/pczone-data.tar.gz
# Chạy ở thư mục pczone/ (Git Bash trên Windows cũng được, cần Docker Desktop đang chạy):
#   bash deploy/export-data.sh
# Chỉ ĐỌC DB dev (mysqldump), không sửa gì. File tạo ra chứa dữ liệu thật (tài khoản, đơn hàng...): chỉ chép lên máy
# chủ của bạn, không chia sẻ, xoá đi sau khi dùng xong.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$ROOT/deploy/data"
CONTAINER="${DEV_MYSQL_CONTAINER:-pczone-mysql}"
# Mật khẩu root của MySQL dev — mặc định trong docker-compose.yml ở gốc dự án
DEV_ROOT_PASSWORD="${DEV_MYSQL_ROOT_PASSWORD:-root}"
IMAGES="$ROOT/apps/web/public/images"

mkdir -p "$OUT/export"
echo "→ Sao DB pczone từ container $CONTAINER..."
docker exec "$CONTAINER" mysqldump -uroot -p"$DEV_ROOT_PASSWORD" --single-transaction --no-tablespaces \
  --default-character-set=utf8mb4 pczone > "$OUT/export/pczone.sql" 2> "$OUT/export/mysqldump.log" || {
  cat "$OUT/export/mysqldump.log"
  exit 1
}

folders=()
for folder in products banners; do
  [ -d "$IMAGES/$folder" ] && folders+=("$folder")
done

echo "→ Nén DB + ảnh (${folders[*]:-không có ảnh})..."
tar -czf "$OUT/pczone-data.tar.gz" -C "$OUT/export" pczone.sql ${folders[@]+-C "$IMAGES" "${folders[@]}"}
rm -rf "$OUT/export"

echo "✓ Đã tạo deploy/data/pczone-data.tar.gz ($(du -h "$OUT/pczone-data.tar.gz" | cut -f1))."
echo "  Chép lên máy chủ, vd:  scp deploy/data/pczone-data.tar.gz <user>@<IP máy chủ>:~/Do_An/pczone/deploy/"
