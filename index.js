/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.0
 * Fitur: WhatsApp Bot + Web Dashboard + Media Viewer
 * Status Auth: MongoDB Atlas (Permanent + Fallback System)
 */

const { 
    default: makeWASocket, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");

const mongoose = require('mongoose'); 
const mongoAuth = require('baileys-mongodb'); 

// Pastikan fungsi auth dipanggil dengan benar
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
const { renderMediaView } = require('./views/mediaView'); 

// --- KONFIGURASI PATH ---
const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
if (!fs.existsSync(PUBLIC_FILES_PATH)) fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });

let botConfig = { 
    quiz: true, jadwalBesok: true, smartFeedback: true, 
    prMingguan: true, sahur: true, tkaReminder: true 
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            Object.assign(botConfig, JSON.parse(data));
            console.log("✅ Konfigurasi dimuat.");
        }
    } catch (e) { console.error("❌ Gagal memuat config:", e.message); }
}
loadConfig();

const saveConfig = () => {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2)); } 
    catch (e) { console.error("❌ Gagal menyimpan config"); }
};

// --- WEB SERVER ---
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
    const fileUrls = filenames.map(name => `${req.protocol}://${req.get('host')}/files/${name}`); 
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
 * MAIN BOT LOGIC
 */
async function start() {
    try {
        addLog("⏳ Menghubungkan ke MongoDB Atlas...");
        
        // SISTEM FALLBACK: Jika Env Variable kosong, pakai link manual ini
        const uri = process.env.MONGODB_URI || "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority";
        
        await mongoose.connect(uri);
        addLog("🗄️ Database Terhubung.");
    } catch (err) {
        addLog("❌ Database Error: " + err.message);
        setTimeout(start, 10000);
        return;
    }

    const { version } = await fetchLatestBaileysVersion();
    
    // Auth State MongoDB
    const { state, saveCreds } = await useMongoDBAuthState(mongoose.connection, "sessions");

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
        keepAliveIntervalMs: 10000
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
            qrCodeData = await QRCode.toDataURL(qr);
            addLog("🔄 QR Code baru tersedia di Dashboard.");
        }
        
        if (connection === "close") {
            isConnected = false;
            const code = lastDisconnect?.error?.output?.statusCode;
            if (code !== DisconnectReason.loggedOut) {
                addLog("🔴 Putus, menyambung ulang...");
                setTimeout(start, 5000);
            } else {
                addLog("⚠️ Logout terdeteksi. Silakan scan ulang.");
            }
        } else if (connection === "open") {
            isConnected = true; 
            qrCodeData = ""; 
            addLog("🟢 Bot Aktif & Terhubung!");
            
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
            addLog(`📩 Pesan dari: ${msg.pushName || 'User'}`);
            await handleMessages(sock, m, botConfig, { 
                getWeekDates, 
                sendJadwalBesokManual 
            });
        }
    });
}

start();
