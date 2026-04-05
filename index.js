/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.5 (Fix Reconnect Loop)
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

const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
if (!fs.existsSync(PUBLIC_FILES_PATH)) fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });

let botConfig = { 
    quiz: true, 
    jadwalBesok: true, 
    smartFeedback: true, 
    prMingguan: true, 
    sahur: true,
    tkaReminder: true 
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            Object.assign(botConfig, JSON.parse(data));
        }
    } catch (e) { console.error("❌ Config Error:", e.message); }
}
loadConfig();

const saveConfig = () => {
    try { fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2)); } 
    catch (e) { console.error("❌ Save Error"); }
};

const app = express();
const port = process.env.PORT || 8080;
let qrCodeData = "";
let isConnected = false;
let sock;
let logs = [];
let stats = { pesanMasuk: 0, totalLog: 0 };

app.use('/files', express.static(PUBLIC_FILES_PATH));

app.get("/tugas/:filenames", (req, res) => {
    const fileUrls = req.params.filenames.split(',').map(name => `${req.protocol}://${req.get('host')}/files/${name}`); 
    res.setHeader('Content-Type', 'text/html');
    res.send(renderMediaView(fileUrls));
});

const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> ${msg}`);
    if (logs.length > 20) logs.pop();
};

app.get("/toggle/:feature", (req, res) => {
    if (botConfig.hasOwnProperty(req.params.feature)) {
        botConfig[req.params.feature] = !botConfig[req.params.feature];
        saveConfig();
    }
    res.redirect("/");
});

app.get("/", (req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

app.listen(port, "0.0.0.0", () => console.log(`✅ Dashboard port ${port}`));

/**
 * CORE BOT FUNCTION
 * Perbaikan utama pada mekanisme Reconnection
 */
async function start() {
    const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://narutoacmilan1_db_user:SyamBot123@cluster0.8h4rcml.mongodb.net/syteam?retryWrites=true&w=majority";

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
            // Penambahan opsi stabilitas
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            retryRequestDelayMs: 5000
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            
            if (connection === "close") {
                isConnected = false;
                const code = lastDisconnect?.error?.output?.statusCode;
                
                // Cegah spam reconnect jika errornya sama
                addLog(`🔴 Putus (Code: ${code}). Mengulang dalam 10 detik...`);
                
                if (code !== DisconnectReason.loggedOut) {
                    setTimeout(start, 10000); 
                }
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = ""; 
                addLog("🟢 Bot Stabil Terhubung!");
                
                // JEDA AGRESIF: Menjalankan scheduler satu per satu dengan jeda lama
                // Ini mencegah bot overload saat baru nyala
                const tasks = [
                    () => initQuizScheduler(sock, botConfig),
                    () => initJadwalBesokScheduler(sock, botConfig),
                    () => initSmartFeedbackScheduler(sock, botConfig),
                    () => initListPrMingguanScheduler(sock, botConfig),
                    () => initSahurScheduler(sock, botConfig),
                    () => initTkaScheduler(sock, botConfig)
                ];

                for (let i = 0; i < tasks.length; i++) {
                    setTimeout(() => {
                        if (isConnected) {
                            try { tasks[i](); } catch (e) { console.error("Sched Error"); }
                        }
                    }, (i + 1) * 10000); // Jeda 10 detik antar fitur
                }
            }
        });

        sock.ev.on("messages.upsert", async (m) => {
            if (m.type === 'notify') {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe || !isConnected) return;
                
                stats.pesanMasuk++;
                // Handler diproses secara 'decoupled' agar tidak mengganggu aliran socket
                setImmediate(async () => {
                    await handleMessages(sock, m, botConfig, { getWeekDates, sendJadwalBesokManual })
                          .catch(() => {});
                });
            }
        });

    } catch (err) {
        setTimeout(start, 15000);
    }
}

start();
