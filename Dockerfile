# Image chung cho API và web của PCZone — deploy/docker-compose.yml chạy 2 service từ cùng image này (README mục 14).
# Giữ nguyên cả thư viện dev: cần Prisma CLI (migrate deploy lúc khởi động) và tsx (script tạo tài khoản quản trị).
FROM node:24-bookworm-slim

# Prisma cần OpenSSL; ca-certificates để gọi HTTPS ra ngoài (AI, email Resend, Google/Facebook, VNPay)
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1 PRISMA_HIDE_UPDATE_MESSAGE=1

# Cài thư viện trước, tách khỏi mã nguồn: sửa mã rồi build lại không phải cài lại từ đầu (cache của Docker)
COPY package.json package-lock.json ./
COPY packages/db/package.json packages/db/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY apps/crawler/package.json apps/crawler/
COPY apps/e2e/package.json apps/e2e/
RUN npm ci --no-audit --no-fund && npm cache clean --force

COPY . .

# Prisma Client cho Linux, rồi build db → api → web
RUN npx prisma generate --schema packages/db/prisma/schema.prisma \
  && npm run build -w @pczone/db \
  && npm run build -w @pczone/api

# Trình duyệt gọi /api/* ngay trên tên miền của trang (Caddy chuyển sang API); server của web gọi thẳng API trong
# mạng Docker. Lúc build chưa có API chạy nên các trang dựng sẵn tạm dùng dữ liệu dự phòng, tự thay bằng dữ liệu thật
# ở lần tải kế tiếp (ISR 60 giây) — deploy.sh tự "làm nóng" các trang này sau khi khởi động.
ENV API_URL=http://api:4000 NEXT_PUBLIC_API_URL=""
# Địa chỉ công khai (PUBLIC_URL trong deploy/.env) — link tuyệt đối của ảnh chia sẻ mạng xã hội trong các trang dựng sẵn
ARG SITE_URL=""
ENV SITE_URL=$SITE_URL
RUN npm run build -w @pczone/web

ENV NODE_ENV=production
