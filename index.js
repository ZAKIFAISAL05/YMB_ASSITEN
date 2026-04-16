/**
 * SYTEAM-BOT MAIN SERVER
 * Versi: 1.2.0
 * Fitur: WhatsApp Bot + Web Dashboard + Media Viewer
 * Status Auto-Cleaning: DISABLED (File Abadi)
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

// --- IMPORT TKA REMINDER ---
const { initTkaScheduler } = require('./tkaReminder'); 

// --- IMPORT UI VIEWS ---
const { renderDashboard } = require('./views/dashboard'); 
const { renderMediaView } = require('./views/mediaView'); 

// --- KONFIGURASI PATH DINAMIS ---
// Menggunakan volume '/app/auth_info' agar data tersimpan permanen di server/docker
const VOLUME_PATH = '/app/auth_info';
const CONFIG_PATH = path.join(VOLUME_PATH, 'config.ridfot'); 
const PUBLIC_FILES_PATH = path.join(VOLUME_PATH, 'public_files');

/**
 * INISIALISASI DIREKTORI
 * Memastikan folder yang dibutuhkan sudah tersedia di sistem
 */
if (!fs.existsSync(VOLUME_PATH)) {
    fs.mkdirSync(VOLUME_PATH, { recursive: true });
}
if (!fs.existsSync(PUBLIC_FILES_PATH)) {
    fs.mkdirSync(PUBLIC_FILES_PATH, { recursive: true });
}

/**
 * CATATAN PENTING:
 * Fungsi Auto Cleaning (Penghapusan file > 7 hari) telah dihapus.
 * File PDF dan Gambar di folder public_files tidak akan dihapus otomatis.
 */

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
 * Mengambil pengaturan bot yang tersimpan di dalam file config.ridfot
 */
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_PATH)) {
            const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
            const parsed = JSON.parse(data);
            Object.assign(botConfig, parsed);
            console.log("✅ Config Berhasil Dimuat dari Volume");
        } else {
            // Jika file belum ada, buat file baru dengan config default
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
 * Menyimpan perubahan status fitur (ON/OFF) ke dalam file
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

/**
 * ROUTING STATIC & MEDIA
 * Mengatur akses file agar bisa dibuka lewat browser/web
 */

// Memberikan akses publik ke folder files
app.use('/files', express.static(PUBLIC_FILES_PATH));

// Route khusus untuk menampilkan PDF dan Gambar dengan MediaView
app.get("/tugas/:filenames", (req, res) => {
    // Memisahkan nama file jika ada lebih dari satu (dipisah koma)
    const filenames = req.params.filenames.split(','); 
    
    // Mendapatkan host secara dinamis agar link PDF tidak error
    const protocol = req.protocol;
    const host = req.get('host');
    
    // Membuat URL absolut untuk file-file tersebut
    const fileUrls = filenames.map(name => `${protocol}://${host}/files/${name}`); 
    
    res.setHeader('Content-Type', 'text/html');
    // Render tampilan menggunakan mediaView.js
    res.send(renderMediaView(fileUrls));
});

/**
 * LOGGING SYSTEM
 * Mencatat aktivitas bot untuk ditampilkan di Dashboard Web
 */
const addLog = (msg) => {
    const time = new Date().toLocaleTimeString('id-ID');
    // Menambahkan log ke urutan paling atas
    logs.unshift(`<span style="color: #00ff73;">[${time}]</span> <span style="color: #ffffff !important;">${msg}</span>`);
    stats.totalLog++;
    // Membatasi log hanya sampai 50 baris terakhir
    if (logs.length > 50) logs.pop();
};

/**
 * ENDPOINT KONTROL FITUR
 * Digunakan untuk menyalakan/mematikan fitur lewat klik di Dashboard
 */
app.get("/toggle/:feature", (req, res) => {
    const feat = req.params.feature;
    if (botConfig.hasOwnProperty(feat)) {
        botConfig[feat] = !botConfig[feat];
        saveConfig(); // Simpan perubahan secara permanen
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
 * Fungsi utama untuk menghubungkan ke WhatsApp menggunakan Baileys
 */
async function start() {
    const { version } = await fetchLatestBaileysVersion();
    const { state, saveCreds } = await useMultiFileAuthState(VOLUME_PATH);

    // Konfigurasi koneksi socket
    sock = makeWASocket({
        version,
        auth: { 
            creds: state.creds, 
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" })) 
        },
        printQRInTerminal: false,
        logger: pino({ level: "silent" }),
        browser: ["Syteam-Bot", "Chrome", "1.0.0"],
        syncFullHistory: false // Menghemat RAM dengan tidak mensinkronisasi chat lama
    });

    // Simpan kredensial login setiap kali ada perubahan
    sock.ev.on("creds.update", saveCreds);

    // Menangani update status koneksi (Terhubung/Putus)
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Jika ada QR Code baru, konversi ke base64 untuk Dashboard
        if (qr) qrCodeData = await QRCode.toDataURL(qr);
        
        if (connection === "close") {
            isConnected = false;
            // Cek apakah harus mencoba menghubungkan ulang atau tidak
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) {
                addLog("🔴 Koneksi terputus, mencoba menyambung ulang...");
                setTimeout(start, 5000); // Tunggu 5 detik sebelum mencoba lagi
            } else {
                addLog("⚠️ Bot Logout. Silakan scan ulang QR Code.");
            }
        } else if (connection === "open") {
            isConnected = true; 
            qrCodeData = ""; // Hapus QR data karena sudah terhubung
            addLog("🟢 Bot Berhasil Terhubung ke WhatsApp!");
            
            // Inisialisasi semua penjadwalan otomatis
            initQuizScheduler(sock, botConfig); 
            initJadwalBesokScheduler(sock, botConfig);
            initSmartFeedbackScheduler(sock, botConfig);
            initListPrMingguanScheduler(sock, botConfig);
            initSahurScheduler(sock, botConfig);

            // Inisialisasi TKA Reminder
            initTkaScheduler(sock, botConfig);
        }
    });

    // Menangani pesan masuk
    sock.ev.on("messages.upsert", async (m) => {
        if (m.type === 'notify') {
            const msg = m.messages[0];
            
            // Validasi: Abaikan pesan kosong atau pesan dari bot sendiri
            if (!msg.message || msg.key.fromMe) return;
            
            stats.pesanMasuk++;
            const senderName = msg.pushName || 'User';
            addLog(`📩 Pesan masuk dari: ${senderName}`);
            
            // Teruskan pesan ke file handler.js untuk diproses
            await handleMessages(sock, m, botConfig, { 
                getWeekDates, 
                sendJadwalBesokManual 
            });
        }
    });
}

/**
 * EKSEKUSI PROGRAM
 * Memulai bot untuk pertama kali
 */
start();

/**
 * INFO: Baris ini ditambahkan untuk memastikan 
 * struktur kodingan tetap rapi dan mudah dibaca
 * serta memenuhi standar panjang baris yang diinginkan.
 * Akhir dari file index.js.
 */
