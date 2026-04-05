/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.0
 * Fitur: WhatsApp Bot + Web Dashboard + Media Viewer
 * Status Auto-Cleaning: DISABLED (File Abadi)
 */

const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const { useMongoDBAuthState } = require('baileys-mongodb'); // Tambahan untuk MongoDB
const mongoose = require('mongoose'); // Tambahan untuk MongoDB
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

app.use('/files', express.static(PUBLIC_FILES_PATH));

app.get("/tugas/:filenames", (req, res) => {
    const filenames = req.params.filenames.split(','); 
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrls = filenames.map(name => `${protocol}://${host}/files/${name}`); 
    res.setHeader('Content-Type', 'text/html');
    res.send(renderMediaView(fileUrls));
});

const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> <span style="color: #ffffff !important;">${msg}</span>`);
    stats.totalLog++;
    if (logs.length > 50) logs.pop();
};

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
    try {
        // Koneksi ke MongoDB Atlas dengan proteksi error
        addLog("⏳ Mencoba menghubungkan ke MongoDB Atlas...");
        await mongoose.connect(process.env.MONGODB_URI, {
            serverSelectionTimeoutMS: 20000, // Timeout 20 detik
        });
        addLog("🗄️ Terhubung ke MongoDB Atlas.");
    } catch (err) {
        addLog("❌ Gagal konek MongoDB: " + err.message);
        console.error("MongoDB Connection Error:", err);
        // Jika gagal, coba lagi dalam 10 detik
        setTimeout(start, 10000);
        return;
    }

    const { version } = await fetchLatestBaileysVersion();
    // Menggunakan MongoDB untuk menyimpan Auth State
    const { state, saveCreds } = await useMongoDBAuthState(mongoose.connection.collection('sessions'));

    sock = makeWASocket({
        version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        printQRInTerminal: true,
        logger: pino({ level: "silent" }),
        browser: ["Ubuntu", "Chrome", "20.0.04"],
        syncFullHistory: false,
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 0,
        keepAliveIntervalMs: 10000
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = await QRCode.toDataURL(qr);
            addLog("🔄 QR Code baru dibuat, silakan scan di Dashboard.");
        }
        
        if (connection === "close") {
            isConnected = false;
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                addLog("🔴 Koneksi terputus, mencoba menyambung ulang...");
                setTimeout(start, 5000);
            } else {
                addLog("⚠️ Bot Logout. Silakan hapus data di MongoDB dan scan ulang.");
            }
        } else if (connection === "open") {
            isConnected = true; 
            qrCodeData = ""; 
            addLog("🟢 Bot Berhasil Terhubung ke WhatsApp!");
            
            initQuizScheduler(sock, botConfig); 
            initJadwalBesokScheduler(sock, botConfig);
            initSmartFeedbackScheduler(sock, botConfig);
            initListPrMingguanScheduler(sock, botConfig);
            initSahurScheduler(sock, botConfig);
            initTkaScheduler(sock, botConfig);
        }
    });

    sock.ev.on("messages.upsert", async (m) => {
        if (m.type === 'notify') {
            const msg = m.messages[0];
            if (!msg.message || msg.key.fromMe) return;
            
            stats.pesanMasuk++;
            const senderName = msg.pushName || 'User';
            addLog(`📩 Pesan masuk dari: ${senderName}`);
            
            await handleMessages(sock, m, botConfig, { 
                getWeekDates, 
                sendJadwalBesokManual 
            });
        }
    });
}

start();

/**
 * INFO: Akhir dari file index.js.
 */
