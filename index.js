/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.7 (Ultimate Connection Stability)
 * Fitur: WhatsApp Bot + Web Dashboard + Media Viewer
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

const { initTkaScheduler } = require('./tkaReminder'); 
const { renderDashboard } = require('./views/dashboard'); 

// --- KONFIGURASI ---
const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
let botConfig = { quiz: true, jadwalBesok: true, smartFeedback: true, prMingguan: true, sahur: true, tkaReminder: true };

// --- EXPRESS SETUP ---
const app = express();
const port = process.env.PORT || 8080;
let qrCodeData = "", isConnected = false, sock, logs = [], stats = { pesanMasuk: 0, totalLog: 0 };

const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> ${msg}`);
    if (logs.length > 15) logs.pop();
};

app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

app.listen(port, "0.0.0.0", () => console.log(`✅ Server Dashboard nyala.`));

/**
 * CORE BOT FUNCTION
 */
async function start() {
    // URI dengan timeout yang lebih panjang (30 detik untuk seleksi server)
    const MONGODB_URI = "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority&serverSelectionTimeoutMS=30000&connectTimeoutMS=30000";

    try {
        addLog("⏳ Menghubungkan ke Database...");
        
        // Memaksa koneksi MongoDB menunggu lebih lama
        const { state, saveCreds } = await useMongoDBAuthState(MONGODB_URI);
        const { version } = await fetchLatestBaileysVersion();

        sock = makeWASocket({
            version,
            auth: { 
                creds: state.creds, 
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }), 
            browser: ["Syteam-Bot", "Chrome", "1.0.0"],
            syncFullHistory: false,
            connectTimeoutMs: 120000, // Tunggu sampai 2 menit buat konek WA
            defaultQueryTimeoutMs: 0
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            
            if (connection === "close") {
                isConnected = false;
                const reason = lastDisconnect?.error?.output?.statusCode;
                addLog(`🔴 Putus (Reason: ${reason}). Reconnect dalam 15 detik...`);
                
                // Jeda reconnect lebih lama biar server gak anggap kita spam
                setTimeout(start, 15000); 
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = ""; 
                addLog("🟢 Bot Berhasil Terhubung & Stabil!");
                
                // Menjalankan scheduler pelan-pelan (jeda 15 detik)
                setTimeout(() => initQuizScheduler(sock, botConfig), 15000);
            }
        });

        sock.ev.on("messages.upsert", async (m) => {
            if (m.type === 'notify') {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                stats.pesanMasuk++;
                await handleMessages(sock, m, botConfig, { getWeekDates, sendJadwalBesokManual }).catch(() => {});
            }
        });

    } catch (err) {
        addLog(`❌ Koneksi DB Gagal: ${err.message}`);
        setTimeout(start, 30000); // Kalau gagal total, tunggu 30 detik baru coba lagi
    }
}

start();
    
