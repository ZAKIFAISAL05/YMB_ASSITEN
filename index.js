/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.3 (Final Stable - Anti Lag)
 * Fitur: WhatsApp Bot + Web Dashboard + Media Viewer
 * Status Auto-Cleaning: DISABLED (File Abadi)
 */

const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
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

// --- IMPORT TKA REMINDER ---
const { initTkaScheduler } = require('./tkaReminder'); 

// --- IMPORT UI VIEWS ---
const { renderDashboard } = require('./views/dashboard'); 
const { renderMediaView } = require('./views/mediaView'); 

// --- KONFIGURASI PATH DINAMIS ---
const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

/**
 * INISIALISASI DIREKTORI
 */
if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
}
if (!fs.existsSync(PUBLIC_FILES_PATH)) {
    fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });
}

// --- KONFIGURASI DEFAULT BOT ---
let botConfig = { 
    quiz: true, 
    jadwalBesok: true, 
    smartFeedback: true, 
    prMingguan: true, 
    sahur: true,
    tkaReminder: true 
};

/**
 * FUNGSI LOAD CONFIG
 */
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(data);
            Object.assign(botConfig, parsed);
            console.log("✅ Config Berhasil Dimuat dari Volume");
        } else {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2));
            console.log("ℹ️ Membuat file konfigurasi baru...");
        }
    } catch (e) { 
        console.error("❌ Gagal memuat config:", e.message); 
    }
}
loadConfig();

/**
 * FUNGSI SAVE CONFIG
 */
const saveConfig = () => {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2));
    } catch (e) { 
        console.error("❌ Gagal menyimpan config"); 
    }
};

// --- INISIALISASI EXPRESS SERVER ---
const app = express();
const port = process.env.PORT || 8080;
let qrCodeData = "";
let isConnected = false;
let sock;
let logs = [];
let stats = { pesanMasuk: 0, totalLog: 0 };

app.use('/files', express.static(PUBLIC_FILES_PATH));

app.get("/tugas/:filenames", (req, res) => {
    const filenames = req.params.filenames.split(','); 
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrls = filenames.map(name => `${protocol}://${host}/files/${name}`); 
    res.setHeader('Content-Type', 'text/html');
    res.send(renderMediaView(fileUrls));
});

/**
 * LOGGING SYSTEM (Optimized)
 */
const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> <span style="color: #ffffff !important;">${msg}</span>`);
    stats.totalLog++;
    if (logs.length > 25) logs.pop(); // Batasi log di dashboard agar tidak berat
};

/**
 * ENDPOINT KONTROL FITUR
 */
app.get("/toggle/:feature", (req, res) => {
    const feat = req.params.feature;
    if (botConfig.hasOwnProperty(feat)) {
        botConfig[feat] = !botConfig[feat];
        saveConfig();
        addLog(`Sistem ${feat} diubah -> ${botConfig[feat] ? 'ON' : 'OFF'}`);
    }
    res.redirect("/");
});

app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Web Dashboard aktif di port ${port}`);
});

/**
 * CORE BOT FUNCTION
 */
async function start() {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority";

    try {
        addLog("⏳ Menghubungkan MongoDB...");
        const { state, saveCreds } = await useMongoDBAuthState(MONGODB_URI);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }), // Matikan spam log Baileys
            browser: ["Syteam-Bot", "Chrome", "1.0.0"],
            syncFullHistory: false, // ANTI LAG: Jangan ambil chat lama
            connectTimeoutMs: 60000
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            
            if (connection === "close") {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    addLog("🔴 Putus, menyambung kembali...");
                    setTimeout(start, 7000); // Beri jeda lebih lama sebelum reconnect
                } else {
                    addLog("⚠️ Logout. Silakan scan ulang.");
                }
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = ""; 
                addLog("🟢 Bot Berhasil Terhubung!");
                
                // JEDA SCHEDULER: Biar tidak crash saat baru nyala
                setTimeout(() => { if(isConnected) initQuizScheduler(sock, botConfig) }, 3000);
                setTimeout(() => { if(isConnected) initJadwalBesokScheduler(sock, botConfig) }, 6000);
                setTimeout(() => { if(isConnected) initSmartFeedbackScheduler(sock, botConfig) }, 9000);
                setTimeout(() => { if(isConnected) initListPrMingguanScheduler(sock, botConfig) }, 12000);
                setTimeout(() => { if(isConnected) initSahurScheduler(sock, botConfig) }, 15000);
                setTimeout(() => { if(isConnected) initTkaScheduler(sock, botConfig) }, 18000);
            }
        });

        sock.ev.on("messages.upsert", async (m) => {
            if (m.type === 'notify') {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                stats.pesanMasuk++;
                if (stats.pesanMasuk % 3 === 0) addLog(`📩 Pesan masuk dari: ${msg.pushName || 'User'}`);
                
                await handleMessages(sock, m, botConfig, { getWeekDates, sendJadwalBesokManual })
                      .catch(e => console.log("Handler Error: ", e.message));
            }
        });

    } catch (err) {
        addLog("❌ Error Fatal: " + err.message);
        setTimeout(start, 10000);
    }
}

start();

/**
 * Akhir dari file index.js.
 * Tetap rapi dan stabil.
 */
