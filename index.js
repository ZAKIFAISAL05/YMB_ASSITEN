/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.3.0
 * Perbaikan: Fix bot typing tapi pesan tidak terkirim ke grup
 * - Tambah sendMessage wrapper dengan timeout & retry
 * - Tambah presenceUpdate clearing agar typing tidak stuck
 * - Tambah rate limit delay antar pesan scheduler
 * - Tambah keepAlive ping agar koneksi tidak drop diam-diam
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
const { 
    initQuizScheduler, 
    initJadwalBesokScheduler, 
    initSmartFeedbackScheduler, 
    initListPrMingguanScheduler, 
    initSahurScheduler,
    getWeekDates, 
    sendJadwalBesokManual 
} = require('./scheduler'); 

// --- IMPORT UI VIEWS ---
const { renderDashboard } = require('./views/dashboard'); 
const { renderMediaView } = require('./views/mediaView'); 

// --- KONFIGURASI PATH DINAMIS ---
const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

if (!fs.existsSync(VOLUME_PATH)) fs.mkdirSync(VOLUME_PATH, { recursive: true });
if (!fs.existsSync(PUBLIC_FILES_PATH)) fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });

// --- KONFIGURASI DEFAULT BOT ---
let botConfig = { 
    quiz: true, 
    jadwalBesok: true, 
    smartFeedback: true, 
    prMingguan: true, 
    sahur: true,
};

function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            Object.assign(botConfig, JSON.parse(data));
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
let schedulerInitialized = false;

// ─────────────────────────────────────────────────────────────
// FIX #1: SAFE SEND MESSAGE WRAPPER
// Masalah utama: sock.sendMessage() ke grup kadang hang selamanya
// tanpa resolve/reject → bot stuck typing, internet terasa "putus".
// Solusi: bungkus dengan Promise.race() + timeout 20 detik.
// Jika gagal, tunggu 3 detik lalu coba 1x lagi (retry).
// ─────────────────────────────────────────────────────────────
const safeSend = async (jid, content, options = {}, retries = 2) => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            // Timeout 20 detik — jika WhatsApp tidak merespons, lempar error
            const result = await Promise.race([
                sock.sendMessage(jid, content, options),
                new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("sendMessage timeout")), 20000)
                )
            ]);

            // FIX #2: Setelah sukses kirim, pastikan status "typing" dibersihkan
            // agar bot tidak terlihat mengetik terus di grup
            try {
                await sock.sendPresenceUpdate('paused', jid);
            } catch (_) { /* abaikan error presence */ }

            return result;

        } catch (err) {
            addLog(`⚠️ Gagal kirim pesan (percobaan ${attempt}/${retries}): ${err.message}`);
            if (attempt < retries) {
                // Tunggu 3 detik sebelum retry agar tidak flood
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
    addLog(`❌ Pesan gagal terkirim setelah ${retries}x percobaan.`);
    return null;
};

// Export safeSend agar bisa dipakai di handler.js dan scheduler.js
// Cara pakai di file lain: const { safeSend } = require('./index');
// TAPI karena circular import bisa bermasalah, lebih baik inject via parameter.
// Kita simpan di global object yang di-pass ke handler & scheduler.
const botUtils = {
    safeSend,
    getWeekDates,
    sendJadwalBesokManual
};

// ─────────────────────────────────────────────────────────────
// FIX #3: KEEPALIVE PING
// Koneksi WhatsApp bisa diam-diam drop tanpa trigger "close" event.
// Ping setiap 30 detik untuk mendeteksi koneksi zombie lebih cepat.
// ─────────────────────────────────────────────────────────────
let keepAliveInterval = null;

const startKeepAlive = () => {
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    keepAliveInterval = setInterval(async () => {
        if (!isConnected || !sock) return;
        try {
            // Query versi WA sebagai "ping" ringan
            await sock.query({
                tag: 'iq',
                attrs: { type: 'get', to: '@s.whatsapp.net', xmlns: 'w:p' }
            });
        } catch (e) {
            // Jika ping gagal, koneksi sudah zombie — reconnect
            addLog("🔄 Koneksi zombie terdeteksi, reconnect...");
            isConnected = false;
            try { sock.end(); } catch (_) {}
        }
    }, 30000); // setiap 30 detik
};

// ─────────────────────────────────────────────────────────────
// LOGGING SYSTEM
// ─────────────────────────────────────────────────────────────
const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> <span style="color: #ffffff !important;">${msg}</span>`);
    stats.totalLog++;
    if (logs.length > 50) logs.pop();
};

// ─────────────────────────────────────────────────────────────
// EXPRESS ROUTES
// ─────────────────────────────────────────────────────────────
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

app.use('/files', express.static(PUBLIC_FILES_PATH));

app.get("/tugas/:filenames", (req, res) => {
    const filenames = req.params.filenames.split(','); 
    const isValid = filenames.every(name => {
        return path.basename(name) === name && !name.includes('..') && /^[\w\-. ]+$/.test(name);
    });
    if (!isValid) return res.status(400).send("Nama file tidak valid.");
    const protocol = req.protocol;
    const host = req.get('host');
    const fileUrls = filenames.map(name => `${protocol}://${host}/files/${name}`); 
    res.setHeader('Content-Type', 'text/html');
    res.send(renderMediaView(fileUrls));
});

app.listen(port, "0.0.0.0", () => {
    console.log(`✅ Web Dashboard aktif di port ${port}`);
});

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

            // FIX #4: Opsi koneksi tambahan agar tidak mudah timeout di grup
            connectTimeoutMs: 60000,      // tunggu 60 detik saat connect
            defaultQueryTimeoutMs: 30000, // timeout per query 30 detik
            keepAliveIntervalMs: 15000,   // built-in keepalive Baileys 15 detik
            retryRequestDelayMs: 2000,    // delay antar retry request
            maxMsgRetryCount: 5,          // maksimal retry per pesan
            getMessage: async () => undefined // hindari error saat decrypt pesan lama
        });

        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            if (qr) qrCodeData = await QRCode.toDataURL(qr);
            
            if (connection === "close") {
                isConnected = false;
                if (keepAliveInterval) clearInterval(keepAliveInterval);

                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

                if (shouldReconnect) {
                    // FIX #5: Delay reconnect lebih lama jika kena rate limit (statusCode 429)
                    const delay = statusCode === 429 ? 30000 : 5000;
                    addLog(`🔴 Koneksi terputus (kode: ${statusCode}), reconnect dalam ${delay/1000}s...`);
                    setTimeout(start, delay);
                } else {
                    addLog("⚠️ Bot Logout. Silakan scan ulang QR Code.");
                    schedulerInitialized = false;
                }
            } else if (connection === "open") {
                isConnected = true; 
                qrCodeData = "";
                addLog("🟢 Bot Berhasil Terhubung ke WhatsApp!");
                
                // Mulai keepalive
                startKeepAlive();

                if (!schedulerInitialized) {
                    // FIX #6: Pass safeSend ke scheduler agar scheduler juga pakai
                    // wrapper yang aman, bukan sock.sendMessage() langsung
                    initQuizScheduler(sock, botConfig, safeSend); 
                    initJadwalBesokScheduler(sock, botConfig, safeSend);
                    initSmartFeedbackScheduler(sock, botConfig, safeSend);
                    initListPrMingguanScheduler(sock, botConfig, safeSend);
                    initSahurScheduler(sock, botConfig, safeSend);
                    schedulerInitialized = true;
                }
            }
        });

        sock.ev.on("messages.upsert", async (m) => {
            if (m.type === 'notify') {
                const msg = m.messages[0];
                if (!msg.message || msg.key.fromMe) return;
                
                stats.pesanMasuk++;
                const senderName = msg.pushName || 'User';
                addLog(`📩 Pesan masuk dari: ${senderName}`);
                
                // FIX #7: Pass safeSend ke handler agar handler tidak langsung
                // panggil sock.sendMessage() yang bisa hang
                await handleMessages(sock, m, botConfig, botUtils, safeSend);
            }
        });

    } catch (err) {
        console.error("❌ Gagal memulai bot:", err.message);
        addLog("❌ Gagal memulai bot, mencoba lagi dalam 10 detik...");
        setTimeout(start, 10000);
    }
}

start();
