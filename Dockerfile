# Gunakan Node.js versi 20 (LTS Iron)
FROM node:20-bookworm

# 1. Command Cepat: Install GIT & Bersihkan Cache APT dalam satu langkah
RUN apt-get update && apt-get install -y git && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Copy Manifest (Hanya package.json)
COPY package*.json ./

# 3. Update: Install Axios & Form-Data (Hapus Google AI karena sudah tidak pakai Key)
RUN npm install --no-audit --no-fund && \
    npm install axios form-data --no-audit --no-fund && \
    npm cache clean --force

# 4. Copy sisa kode
COPY . .

# Command jalankan aplikasi
CMD ["node", "index.js"]
