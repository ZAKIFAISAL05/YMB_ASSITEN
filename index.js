/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.0 (Original Logic - Restored)
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
const { renderMediaView } = require('./views/mediaView'); 

// --- KONFIGURASI PATH ---
const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
if (!fs.existsSync(PUBLIC_FILES_PATH)) fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });

// --- CONFIG DEFAULT ---
let botConfig = { 
    quiz: true, 
    jadwalBesok: true, 
    smartFeedback: true, 
    prMingguan: true, 
    sahur: true,
    tkaReminder: true 
};

// --- SERVER SETUP ---
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
    logs.unshift(`[${time}] ${msg}`);
    if (logs.length > 20) logs.pop();
};

app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Server nyala di port ${port}`);
});

/**
 * FUNGSI START UTAMA (LOGIKA LAMA)
 */
async function start() {
    const MONGODB_URI = "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority";

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
            syncFullHistory: false
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            
            if (connection === "close") {
                isConnected = false;
                const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    addLog("🔴 Putus, mencoba nyambung lagi...");
                    setTimeout(start, 5000);
                }
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = ""; 
                addLog("🟢 Bot Berhasil Terhubung!");
                
                // Jalankan scheduler (Logika Lama)
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
                await handleMessages(sock, m, botConfig, { getWeekDates, sendJadwalBesokManual })
                      .catch(e => console.log(e));
            }
        });

    } catch (err) {
        console.error(err);
        setTimeout(start, 10000);
    }
}

start();
        
