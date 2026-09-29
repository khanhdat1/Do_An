#!/usr/bin/env bash
# Build + khởi động PCZone trên máy chủ bằng Docker Compose (README mục 14). Chạy trong thư mục pczone/deploy:
#   bash deploy.sh                        lần đầu với DB trống, hoặc mỗi lần cập nhật mã (git pull trước)
#   bash deploy.sh pczone-data.tar.gz     kèm dữ liệu đóng gói từ máy dev (export-data.sh): ảnh + GHI ĐÈ toàn bộ DB
# Thêm --yes để không hỏi lại trước khi ghi đè DB.
set -euo pipefail

DATA=""
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --yes) ASSUME_YES=1 ;;
    *) DATA="$arg" ;;
  esac
done
if [ -n "$DATA" ]; then
  [ -f "$DATA" ] || { echo "✗ Không thấy file $DATA"; exit 1; }
  DATA="$(cd "$(dirname "$DATA")" && pwd)/$(basename "$DATA")"
fi

cd "$(dirname "$0")"
[ -f .env ] || { echo "✗ Chưa có deploy/.env — chạy: cp .env.example .env  rồi điền (README mục 14)"; exit 1; }
mkdir -p data/products data/banners

if [ -n "$DATA" ]; then
  if [ "$ASSUME_YES" -ne 1 ]; then
    read -r -p "Nạp dữ liệu từ $DATA sẽ GHI ĐÈ toàn bộ DB trên máy chủ này. Gõ yes để tiếp tục: " answer
    [ "$answer" = "yes" ] || { echo "Đã huỷ, không thay đổi gì."; exit 1; }
  fi
  echo "→ Giải nén ảnh + bản sao DB vào deploy/data..."
  tar -xzf "$DATA" -C data
fi

echo "→ Build image (lần đầu mất vài phút)..."
docker compose build

echo "→ Khởi động MySQL..."
docker compose up -d mysql
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$(docker compose ps -q mysql)")" = "healthy" ]; do sleep 2; done

if [ -f data/pczone.sql ]; then
  echo "→ Nạp bản sao DB..."
  docker compose exec -T mysql sh -c 'exec mysql -uroot -p"$MYSQL_ROOT_PASSWORD" pczone' < data/pczone.sql
  rm -f data/pczone.sql
fi

# Ảnh sản phẩm phải có trước khi web khởi động (next start chỉ phục vụ file có sẵn trong public/ lúc đó)
echo "→ Khởi động API (tự áp migration), web, Caddy..."
docker compose up -d

web_get() {
  docker compose exec -T web node -e "fetch('http://localhost:3000$1').then(r=>r.text()).then(()=>process.exit(0)).catch(()=>process.exit(1))" >/dev/null 2>&1
}
echo "→ Chờ web sẵn sàng..."
for _ in $(seq 1 90); do web_get / && break; sleep 2; done

# Lúc build image chưa có API nên các trang dựng sẵn mang dữ liệu dự phòng; sau 60 giây (ISR) lần tải đầu sẽ kích hoạt
# dựng lại bằng dữ liệu thật — làm hộ lần tải đó để khách đầu tiên đã thấy dữ liệu thật
built=$(date -d "$(docker image inspect -f '{{.Created}}' pczone-app)" +%s)
wait_s=$((built + 65 - $(date +%s)))
if [ "$wait_s" -gt 0 ]; then
  echo "→ Chờ ${wait_s} giây rồi làm mới các trang dựng sẵn..."
  sleep "$wait_s"
fi
# (danh sách trang ○ có "Revalidate 1m" trong kết quả `next build`)
for page in / /danh-muc /khuyen-mai /gio-hang /so-sanh /yeu-thich /thanh-toan /tra-cuu-don-hang /quen-mat-khau \
  /tai-khoan/don-hang /tai-khoan/cau-hinh; do
  web_get "$page" || true
done

echo "✓ PCZone đang chạy tại $(grep -E '^PUBLIC_URL=' .env | cut -d= -f2-)"
echo "  Xem log: docker compose logs -f api web    |    Trạng thái: docker compose ps"
