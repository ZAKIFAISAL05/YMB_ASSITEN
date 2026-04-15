# Gunakan Node.js versi 20 (LTS Iron)
FROM node:20-bookworm-slim

# 1. Install library sistem yang dibutuhkan (tambah ffmpeg buat fitur stiker/video)
RUN apt-get update && apt-get install -y \
    git \
    ffmpeg \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Copy manifest
COPY package*.json ./

# 3. Install dependencies (pakai --production jika sudah dideploy)
RUN npm install --no-audit --no-fund && \
    npm cache clean --force

# 4. Copy sisa kode (Pastikan sudah ada .dockerignore agar folder sesi tidak ikut ter-copy)
COPY . .

# Tambahkan user non-root (Opsional, tapi lebih aman)
# RUN useradd -m botuser && chown -R botuser:botuser /app
# USER botuser

CMD ["node", "index.js"]
