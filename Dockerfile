FROM node:20-bookworm-slim 
# Gunakan -slim supaya lebih ringan

RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package*.json ./

# Install semua sekaligus untuk mengurangi layer
RUN npm install --no-audit --no-fund && \
    npm install mongodb@4.1 axios form-data mongoose baileys-mongodb uuid --no-audit --no-fund

COPY . .
EXPOSE 8080
CMD ["node", "index.js"]
