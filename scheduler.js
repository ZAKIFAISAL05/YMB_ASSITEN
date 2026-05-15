/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.5.1 (Integrated Birthday Webhook)
 * Upgrade: Birthday Webhook, Performa ringan, deteksi pesan akurat, reconnect stabil
 */

const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    DisconnectReason, 
    fetchLatestBaileysVersion, 
    makeCacheableSignalKeyStore 
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const express = require("express");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

// --- IMPORT HANDLER & SCHEDULER ---
const { handleMessages } = require('./handler'); 
const { handleEmergency } = require('./features/safety'); 
const { 
    initQuizScheduler, 
    initJadwalBesokScheduler, 
    initSmartFeedbackScheduler, 
    initListPrMingguanScheduler, 
    initSahurScheduler,
    getWeekDates, 
    sendJadwalBesokManual 
} = require('./scheduler'); 

const {
    initJadwalkisiBesokScheduler, 
    initListKisiKisiScheduler,
    initPersiapanBesokScheduler,
    sendJadwalkisiBesokManual 
} = require('./kisi-kisi/scheduler');

const { renderDashboard } = require('./views/dashboard'); 
const { renderMediaView } = require('./views/mediaView'); 

// ─────────────────────────────────────────────────────────────
// WAKTU BOT START — untuk filter pesan lama saat reconnect
// ─────────────────────────────────────────────────────────────
const BOT_START_TIME = Math.floor(Date.now() / 1000);

// ─────────────────────────────────────────────────────────────
// CACHE MESSAGE ID — pakai LRU manual agar hemat memori
// ─────────────────────────────────────────────────────────────
const MAX_CACHE_SIZE = 300;
const processedMsgIds = new Map();

function isAlreadyProcessed(msgId) {
    if (processedMsgIds.has(msgId)) return true;
    if (processedMsgIds.size >= MAX_CACHE_SIZE) {
        const firstKey = processedMsgIds.keys().next().value;
        processedMsgIds.delete(firstKey);
    }
    processedMsgIds.set(msgId, Date.now());
    return false;
}

setInterval(() => {
    const cutoff = Date.now() - 30 * 60 * 1000;
    for (const [id, ts] of processedMsgIds) {
        if (ts < cutoff) processedMsgIds.delete(id);
    }
}, 10 * 60 * 1000);

// ─────────────────────────────────────────────────────────────
// KONFIGURASI PATH DINAMIS
// ─────────────────────────────────────────────────────────────
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
    autoRejectCall: true,
    kisiKisiBesok: true,
    kisiKisiMingguan: true,
    persiapanBesok: true,
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(data);
            botConfig = Object.assign({}, botConfig, parsed);
            console.log("✅ Config Berhasil Dimuat");
        } else {
            fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2));
        }
    } catch (e) { console.error("❌ Gagal memuat config:", e.message); }
}
loadConfig();

const saveConfig = () => {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(botConfig, null, 2));
    } catch (e) { console.error("❌ Gagal menyimpan config:", e.message); }
};

// ─────────────────────────────────────────────────────────────
// FUNGSI PENGAMANAN & PEMBERSIH (SELF-HEALING)
// ─────────────────────────────────────────────────────────────
function cleanSessionTrash() {
    try {
        const files = fs.readdirSync(VOLUME_PATH);
        let count = 0;
        files.forEach(file => {
            if (file.startsWith('pre-key-') || file.startsWith('session-') || file.startsWith('sender-key-')) {
                fs.unlinkSync(path.join(VOLUME_PATH, file));
                count++;
            }
        });
        addLog(`🧹 Sampah sesi dibersihkan: ${count} file`);
    } catch (e) { console.error("Gagal bersih-bersih sesi:", e.message); }
}

// ─────────────────────────────────────────────────────────────
// INISIALISASI EXPRESS SERVER & WEBHOOK
// ─────────────────────────────────────────────────────────────
const app = express();
app.use(express.json()); // Wajib untuk menerima JSON dari Google Apps Script
const port = process.env.PORT || 8080;
let qrCodeData = "";
let isConnected = false;
let sock;
let logs = [];
let stats = { pesanMasuk: 0, totalLog: 0, teleponDitolak: 0 };
let schedulerInitialized = false;
let adminNotified = false;

// Webhook untuk Google Apps Script (Birthday Bot)
app.post('/bday-webhook', async (req, res) => {
    const { action, target, message } = req.body;
    if (action === 'sendMessage') {
        try {
            if (!sock || !isConnected) return res.status(503).json({ error: "Bot offline" });
            await sock.sendMessage(target, { text: message });
            addLog(`🎂 Birthday Webhook: Mengirim ucapan ke ${target}`);
            return res.status(200).json({ status: "success" });
        } catch (err) {
            addLog(`❌ Birthday Webhook Error: ${err.message}`);
            return res.status(500).json({ error: err.message });
        }
    }
    res.status(400).send('Invalid Action');
});

// ─────────────────────────────────────────────────────────────
// RECONNECT & SAFE SEND
// ─────────────────────────────────────────────────────────────
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;

const safeSend = async (jid, content, options = {}, retries = 2) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            if (!sock || !isConnected) return null;
            const result = await sock.sendMessage(jid, content, options);
            return result;
        } catch (err) {
            if (attempt < retries) await new Promise(r => setTimeout(r, 3000));
        }
    }
    return null;
};

const botUtils = { safeSend, getWeekDates, sendJadwalBesokManual };
const botUtilsKisi = { safeSend, getWeekDates, sendJadwalkisiBesokManual };

let keepAliveInterval = null;
const startKeepAlive = () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(async () => {
        if (!isConnected || !sock) return;
        try {
            await sock.query({ tag: 'iq', attrs: { type: 'get', to: '@s.whatsapp.net', xmlns: 'w:p' } });
        } catch (e) {
            isConnected = false;
            try { sock.end(); } catch (_) {}
        }
    }, 30000);
};

// ─────────────────────────────────────────────────────────────
// AUTO-REJECT PANGGILAN
// ─────────────────────────────────────────────────────────────
async function handleIncomingCall(callEvents) {
    if (!botConfig.autoRejectCall) return;
    for (const call of callEvents) {
        if (call.status !== 'offer') continue;
        try {
            await sock.rejectCall(call.id, call.from);
            stats.teleponDitolak++;
            addLog(`🚫 Panggilan DITOLAK otomatis dari: ${call.from}`);
            await safeSend(call.from, { text: `⛔ *Panggilan Ditolak Otomatis*\n\nMaaf, bot ini tidak dapat menerima panggilan.` });
        } catch (err) { addLog(`❌ Gagal menolak panggilan: ${err.message}`); }
    }
}

const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> <span style="color: #ffffff !important;">${msg}</span>`);
    stats.totalLog++;
    if (logs.length > MAX_LOGS) logs.length = MAX_LOGS;
};

// ─────────────────────────────────────────────────────────────
// EXPRESS ROUTES (DASHBOARD)
// ─────────────────────────────────────────────────────────────
app.get("/toggle/:feature", (req, res) => {
    const feat = req.params.feature;
    if (Object.prototype.hasOwnProperty.call(botConfig, feat)) {
        botConfig[feat] = !botConfig[feat];
        saveConfig();
        addLog(`Sistem ${feat} diubah -> ${botConfig[feat] ? 'ON' : 'OFF'}`);
    }
    res.redirect("/");
});

app.get("/", (req, res) => {
    res.send(renderDashboard(isConnected, qrCodeData, botConfig, stats, logs, port));
});

app.use('/files', express.static(PUBLIC_FILES_PATH));

app.get("/tugas/:filenames", (req, res) => {
    const filenames = req.params.filenames.split(','); 
    const fileUrls = filenames.map(name => `${req.protocol}://${req.get('host')}/files/${name}`); 
    res.send(renderMediaView(fileUrls));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Web Dashboard & Webhook aktif di port ${port}`);
});

function scheduleReconnect(baseDelayMs = 5000) {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) process.exit(1);
    const delay = Math.min(baseDelayMs * Math.pow(1.5, reconnectAttempts), 60000);
    reconnectAttempts++;
    reconnectTimer = setTimeout(async () => {
        reconnectTimer = null;
        await start();
    }, delay);
}

function extractMessageText(msg) {
    const m = msg.message;
    if (!m) return "";
    if (m.conversation) return m.conversation;
    if (m.extendedTextMessage?.text) return m.extendedTextMessage.text;
    if (m.imageMessage?.caption) return m.imageMessage.caption;
    if (m.videoMessage?.caption) return m.videoMessage.caption;
    return "";
}

// ─────────────────────────────────────────────────────────────
// CORE BOT FUNCTION
// ─────────────────────────────────────────────────────────────
async function start() {
    try {
        const { version } = await fetchLatestBaileysVersion();
        const { state, saveCreds } = await useMultiFileAuthState(VOLUME_PATH);

        sock = makeWASocket({
            version,
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }))
            },
            printQRInTerminal: false,
            logger: pino({ level: "silent" }),
            browser: ["Ubuntu", "Firefox", "20.0.0"],
            syncFullHistory: false,
            getMessage: async () => { return undefined; }
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            if (connection === "close") {
                isConnected = false;
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                if (statusCode === DisconnectReason.loggedOut) {
                    const credsPath = path.join(VOLUME_PATH, 'creds.json');
                    if (fs.existsSync(credsPath)) fs.unlinkSync(credsPath);
                }
                scheduleReconnect(5000);
            } else if (connection === "open") {
                isConnected = true;
                reconnectAttempts = 0;
                qrCodeData = "";
                addLog("🟢 Bot Berhasil Terhubung!");
                startKeepAlive();
                if (!schedulerInitialized) {
                    initQuizScheduler(sock, botConfig, () => isConnected);
                    initJadwalBesokScheduler(sock, botConfig);
                    initSmartFeedbackScheduler(sock, botConfig);
                    initListPrMingguanScheduler(sock, botConfig);
                    initSahurScheduler(sock, botConfig);
                    initJadwalkisiBesokScheduler(sock, botConfig);
                    initListKisiKisiScheduler(sock, botConfig);
                    initPersiapanBesokScheduler(sock, botConfig);
                    schedulerInitialized = true;
                }
            }
        });

        sock.ev.on("call", async (callEvents) => { await handleIncomingCall(callEvents); });

        sock.ev.on("messages.upsert", async (m) => {
            if (m.type !== 'notify') return;
            for (const msg of m.messages) {
                if (!msg?.message || msg.key.fromMe) continue;
                if (isAlreadyProcessed(msg.key.id)) continue;

                stats.pesanMasuk++;
                const body = extractMessageText(msg);

                let isEmergency = false;
                try { isEmergency = await handleEmergency(sock, msg, body); } catch (e) {}
                if (isEmergency) continue;

                try {
                    await handleMessages(sock, { type: m.type, messages: [msg] }, botConfig, botUtils, safeSend, botUtilsKisi);
                } catch (err) { console.error("Handler Error:", err); }
            }
        });

    } catch (err) { scheduleReconnect(10000); }
}

const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    saveConfig();
    process.exit(0);
};

let isShuttingDown = false;
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start();
