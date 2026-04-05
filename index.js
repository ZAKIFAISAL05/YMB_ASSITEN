/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.9 (Stable Legacy Edition)
 * Driver: MongoDB 4.1 Optimized
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

// --- IMPORT ASLI ---
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

// --- PATHS ---
const VOLUME_PATH = '/app/auth_info';
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
if (!fs.existsSync(PUBLIC_FILES_PATH)) fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });

let botConfig = { quiz: true, jadwalBesok: true, smartFeedback: true, prMingguan: true, sahur: true, tkaReminder: true };

// --- SERVER ---
const app = express();
const port = process.env.PORT || 8080;
let qrCodeData = "", isConnected = false, sock, logs = [], stats = { pesanMasuk: 0, totalLog: 0 };

app.use('/files', express.static(PUBLIC_FILES_PATH));

app.get("/tugas/:filenames", (req, res) => {
    const filenames = req.params.filenames.split(','); 
    const fileUrls = filenames.map(name => `${req.protocol}://${req.get('host')}/files/${name}`); 
    res.setHeader('Content-Type', 'text/html');
    res.send(renderMediaView(fileUrls));
});

const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`[${time}] ${msg}`);
    if (logs.length > 20) logs.pop();
};

app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

app.listen(port, "0.0.0.0", () => console.log(`✅ Dashboard Online`));

/**
 * START FUNCTION (Logika Index Lama)
 */
async function start() {
    // Tambahkan opsi keepAlive untuk MongoDB 4.1
    const MONGODB_URI = "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority&connectTimeoutMS=60000&socketTimeoutMS=60000";

    try {
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
            connectTimeoutMs: 60000
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            
            if (connection === "close") {
                isConnected = false;
                const code = lastDisconnect?.error?.output?.statusCode;
                if (code !== DisconnectReason.loggedOut) {
                    addLog("🔴 Putus, nyambung lagi dalam 5 detik...");
                    setTimeout(start, 5000);
                }
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = ""; 
                addLog("🟢 Bot Berhasil Terhubung!");
                
                // Eksekusi Scheduler Original
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
                await handleMessages(sock, m, botConfig, { getWeekDates, sendJadwalBesokManual }).catch(() => {});
            }
        });

    } catch (err) {
        console.error("Fatal Error:", err);
        setTimeout(start, 10000);
    }
}

start();
    
