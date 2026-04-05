/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.3 (Optimized & MongoDB Auth)
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
        console.error("❌ Gagal menyimpan config ke volume penyimpanan"); 
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

// Memberikan akses publik ke folder files
app.use('/files', express.static(PUBLIC_FILES_PATH));

// Route khusus untuk menampilkan PDF dan Gambar
app.get("/tugas/:filenames", (req, res) => {
    const filenames = req.params.filenames.split(','); 
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrls = filenames.map(name => `${protocol}://${host}/files/${name}`); 
    res.setHeader('Content-Type', 'text/html');
    res.send(renderMediaView(fileUrls));
});

/**
 * LOGGING SYSTEM
 */
const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> <span style="color: #ffffff !important;">${msg}</span>`);
    stats.totalLog++;
    if (logs.length > 30) logs.pop(); // Optimasi memori log
};

/**
 * ENDPOINT KONTROL FITUR
 */
app.get("/toggle/:feature", (req, res) => {
    const feat = req.params.feature;
    if (botConfig.hasOwnProperty(feat)) {
        botConfig[feat] = !botConfig[feat];
        saveConfig();
        const status = botConfig[feat] ? 'ON' : 'OFF';
        addLog(`Sistem ${feat} diubah -> ${status}`);
    }
    res.redirect("/");
});

// Route Utama Dashboard
app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

// Menjalankan server Express
app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Web Dashboard aktif di port ${port}`);
});

/**
 * CORE BOT FUNCTION
 * Menggunakan MongoDB URI untuk stabilitas login
 */
async function start() {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority";

    try {
        addLog("⏳ Menghubungkan ke Database MongoDB...");
        const { state, saveCreds } = await useMongoDBAuthState(MONGODB_URI);

        const { version } = await fetchLatestBaileysVersion();

        // Konfigurasi koneksi socket (Anti-Lag)
        sock = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "fatal" })) 
            },
            printQRInTerminal: false,
            logger: pino({ level: "fatal" }),
            browser: ["Syteam-Bot", "Chrome", "1.0.0"],
            syncFullHistory: false, // Penting: Jangan sinkron pesan lama agar tidak LAG
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            
            if (connection === "close") {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    addLog("🔴 Koneksi terputus, menyambung ulang...");
                    setTimeout(start, 5000);
                } else {
                    addLog("⚠️ Bot Logout. Silakan scan ulang.");
                }
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = ""; 
                addLog("🟢 Bot Berhasil Terhubung ke WhatsApp!");
                
                // Inisialisasi scheduler dengan jeda agar tidak spike CPU
                setTimeout(() => initQuizScheduler(sock, botConfig), 2000);
                setTimeout(() => initJadwalBesokScheduler(sock, botConfig), 4000);
                setTimeout(() => initSmartFeedbackScheduler(sock, botConfig), 6000);
                setTimeout(() => initListPrMingguanScheduler(sock, botConfig), 8000);
                setTimeout(() => initSahurScheduler(sock, botConfig), 10000);
                setTimeout(() => initTkaScheduler(sock, botConfig), 12000);
            }
        });

        sock.ev.on("messages.upsert", async (m) => {
            if (m.type === 'notify') {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                stats.pesanMasuk++;
                const senderName = msg.pushName || 'User';
                if (stats.pesanMasuk % 5 === 0) addLog(`📩 Memproses pesan dari: ${senderName}`);
                
                await handleMessages(sock, m, botConfig, { 
                    getWeekDates, 
                    sendJadwalBesokManual 
                });
            }
        });

    } catch (err) {
        addLog("❌ Error: " + err.message);
        setTimeout(start, 10000);
    }
}

/**
 * EKSEKUSI PROGRAM
 */
start();

/**
 * Akhir dari file index.js.
 * Menjaga struktur tetap rapi dan fungsional.
 */
