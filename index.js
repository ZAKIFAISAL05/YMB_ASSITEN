/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.3 (Optimized)
 * Fokus: Stabilitas & Performa (Anti-Lag)
 */

const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore,
    useMultiFileAuthState // Backup jika mongo bermasalah
} = require("@whiskeysockets/baileys");

const mongoAuth = require('baileys-mongodb'); 
const useMongoDBAuthState = mongoAuth.default || mongoAuth; 

const pino = require("pino");
const express = require("express");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

// --- IMPORT HANDLER & SCHEDULER ---
const { handleMessages } = require('./handler'); 
const { 
    initQuizScheduler, 
    initJadwalBesokScheduler, 
    initSmartFeedbackScheduler, 
    initListPrMingguanScheduler, 
    initSahurScheduler,
    getWeekDates, 
    sendJadwalBesokManual 
} = require('./scheduler'); 

const { initTkaScheduler } = require('./tkaReminder'); 
const { renderDashboard } = require('./views/dashboard'); 

// --- KONFIGURASI & PATH ---
const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
if (!fs.existsSync(PUBLIC_FILES_PATH)) fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });

let botConfig = { 
    quiz: true, jadwalBesok: true, smartFeedback: true, 
    prMingguan: true, sahur: true, tkaReminder: true 
};

// Optimization: Gunakan Map untuk store sementara yang butuh akses cepat
const msgRetryCache = new Map();

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            Object.assign(botConfig, JSON.parse(data));
        }
    } catch (e) {}
}
loadConfig();

// --- WEB SERVER OPTIMIZATION ---
const app = express();
const port = process.env.PORT || 8080;
let qrCodeData = "";
let isConnected = false;
let sock;
let logs = [];
let stats = { pesanMasuk: 0, totalLog: 0 };

// Limit log agar tidak membuat Dashboard lag
const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> ${msg}`);
    stats.totalLog++;
    if (logs.length > 30) logs.pop(); // Perkecil history log di memori
};

app.use('/files', express.static(PUBLIC_FILES_PATH));

app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Web Dashboard aktif di port ${port}`);
});

/**
 * MAIN BOT LOGIC (ANTI-LAG VERSION)
 */
async function start() {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority";

    try {
        addLog("⏳ Menghubungkan ke Database...");
        const { state, saveCreds } = await useMongoDBAuthState(MONGODB_URI);
        
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            // Optimization: Menggunakan cacheable keystore untuk mengurangi I/O database
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            printQRInTerminal: false, // QR diurus dashboard
            logger: pino({ level: "fatal" }), // Matikan log internal Baileys yang berat
            browser: ["SYTEAM-BOT", "Chrome", "1.0.0"],
            syncFullHistory: false, // JANGAN sinkron history lama (Bikin LAG)
            markOnlineOnConnect: true,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0, // Hindari timeout pada koneksi lambat
            msgRetryCounterCache: msgRetryCache, // Gunakan cache map
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) {
                qrCodeData = await QRCode.toDataURL(qr);
                addLog("🔄 QR Code diperbarui.");
            }

            if (connection === "close") {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                
                if (shouldReconnect) {
                    addLog("🔴 Koneksi terputus, mencoba lagi...");
                    setTimeout(start, 5000);
                } else {
                    addLog("⚠️ Sesi berakhir. Silakan scan ulang.");
                }
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = ""; 
                addLog("🟢 Bot Aktif & Stabil!");
                
                // Jalankan scheduler secara bertahap agar tidak spike CPU
                setTimeout(() => initQuizScheduler(sock, botConfig), 2000);
                setTimeout(() => initJadwalBesokScheduler(sock, botConfig), 4000);
                setTimeout(() => initSmartFeedbackScheduler(sock, botConfig), 6000);
                setTimeout(() => initListPrMingguanScheduler(sock, botConfig), 8000);
                setTimeout(() => initTkaScheduler(sock, botConfig), 10000);
            }
        });

        sock.ev.on("messages.upsert", async (m) => {
            if (m.type === 'notify') {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                stats.pesanMasuk++;
                // Jangan log setiap pesan masuk ke dashboard jika traffic tinggi
                if (stats.pesanMasuk % 5 === 0) addLog(`📩 Memproses ${stats.pesanMasuk} pesan...`);
                
                // Pastikan handler tidak memblokir proses utama
                handleMessages(sock, m, botConfig, { getWeekDates, sendJadwalBesokManual })
                    .catch(e => console.error("Handler Error:", e));
            }
        });

    } catch (err) {
        addLog("❌ Error: " + err.message);
        setTimeout(start, 10000);
    }
}

// Optimization: Handle unhandled rejections agar bot tidak mati mendadak
process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

start();
