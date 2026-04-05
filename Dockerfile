# Gunakan Node.js versi 20 (LTS Iron)
FROM node:20-bookworm

# 1. Install GIT & Dependencies System
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Copy Manifest
COPY package*.json ./

# 3. Install Dependencies dengan MongoDB v4.1
# Saya tambahkan mongodb@4.1 secara spesifik di sini agar sesuai permintaanmu
RUN npm install --no-audit --no-fund && \
    npm install mongodb@4.1 axios form-data mongoose baileys-mongodb uuid --no-audit --no-fund && \
    npm cache clean --force

# 4. Copy sisa kode
COPY . .

# Tambahkan label agar Railway tahu port yang digunakan
EXPOSE 8080

# Command jalankan aplikasi
CMD ["node", "index.js"]
