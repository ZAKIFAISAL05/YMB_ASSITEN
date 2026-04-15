const { QUIZ_BANK } = require('./quiz'); 
const { JADWAL_PELAJARAN: JADWAL_STATIS, MOTIVASI_SEKOLAH } = require('./constants');
const db = require('./data');
const fs = require('fs'); 
const axios = require('axios');

const ID_GRUP_TUJUAN = '120363403625197368@g.us'; 
const KUIS_PATH = '/app/auth_info/kuis.json';
const LAST_SENT_PATH = '/app/auth_info/last_sent.json';

function getWIBDate() {
    return new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta" }));
}

function getWeekDates() {
    const now = getWIBDate();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    if (dayOfWeek === 6) {
        monday.setDate(now.getDate() + 2);
    } else if (dayOfWeek === 0) {
        monday.setDate(now.getDate() + 1);
    } else {
        monday.setDate(now.getDate() + (1 - dayOfWeek));
    }
    const dates = [];
    for (let i = 0; i < 5; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        dates.push(`${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`);
    }
    return { dates, periode: `${dates[0]} - ${dates[4]}` };
}

function readLastSent() {
    try {
        if (fs.existsSync(LAST_SENT_PATH)) {
            return JSON.parse(fs.readFileSync(LAST_SENT_PATH, 'utf-8'));
        }
    } catch (e) { }
    return {};
}

function writeLastSent(data) {
    try {
        const current = readLastSent();
        const updated = { ...current, ...data };
        fs.writeFileSync(LAST_SENT_PATH, JSON.stringify(updated, null, 2));
    } catch (e) { console.error("Gagal tulis last_sent.json:", e.message); }
}

async function isTanggalMerah() {
    try {
        const now = getWIBDate();
        const yyyy = now.getFullYear();
        const mm = String(now.getMonth() + 1).padStart(2, '0');
        const dd = String(now.getDate()).padStart(2, '0');
        const tglSekarang = `${yyyy}-${mm}-${dd}`;
        const response = await axios.get(`https://dayoffapi.vercel.app/api?year=${yyyy}`);
        const libur = response.data.find(h => h.holiday_date === tglSekarang);
        return !!libur;
    } catch (error) {
        return false;
    }
}

function isJamKirim(jam, menit, targetJam) {
    // Toleransi 2 menit agar pasti terkirim walau interval telat
    return jam === targetJam && (menit >= 0 && menit <= 2);
}

async function waitUntilConnected(sock, label = '') {
    const maxWait = 5 * 60 * 1000; 
    const interval = 10 * 1000;    
    let elapsed = 0;
    while (!(sock && sock.user)) {
        if (elapsed >= maxWait) return false;
        console.log(`[${label}] Menunggu koneksi...`);
        await new Promise(r => setTimeout(r, interval));
        elapsed += interval;
    }
    return true;
}

// --- SAHUR ---
async function initSahurScheduler(sock, botConfig) {
    console.log("✅ Scheduler Sahur Aktif (04:00 WIB)");
    setInterval(async () => {
        if (!botConfig || botConfig.sahur === false) return;
        const now = getWIBDate();
        const tglID = `sahur-${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`;
        const lastSent = readLastSent();

        if (isJamKirim(now.getHours(), now.getMinutes(), 4) && !lastSent[tglID]) {
            const siap = await waitUntilConnected(sock, 'Sahur');
            if (!siap) return;
            const PESAN_SAHUR_LIST = [
                `🌙 *REMINDER SAHUR* 🕌\n━━━━━━━━━━━━━━━━━━━━\n\nSelamat makan sahur semuanya! Jangan lupa niat puasa ya.\n\n━━━━━━━━━━━━━━━━━━━━`,
                `🌙 *SAHUR.. SAHURRR!* 🕌\n━━━━━━━━━━━━━━━━━━━━\n\nAyo bangun, waktunya mengisi energi untuk hari ini!\n\n━━━━━━━━━━━━━━━━━━━━`
            ];
            const pesanRandom = PESAN_SAHUR_LIST[Math.floor(Math.random() * PESAN_SAHUR_LIST.length)];
            await sock.sendMessage(ID_GRUP_TUJUAN, { text: pesanRandom });
            writeLastSent({ [tglID]: true });
        }
    }, 45000);
}

// --- QUIZ ---
async function initQuizScheduler(sock, botConfig) {
    console.log("✅ Scheduler Polling Aktif");
    setInterval(async () => {
        if (!botConfig || botConfig.quiz === false) return;
        const now = getWIBDate();
        const hariAngka = now.getDay();
        const tglID = `quiz-${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`;
        const lastSent = readLastSent();

        if (hariAngka < 1 || hariAngka > 5) return;

        let jamKirim = (hariAngka === 1) ? 14 : (hariAngka === 5) ? 11 : 13;

        if (isJamKirim(now.getHours(), now.getMinutes(), jamKirim) && !lastSent[tglID]) {
            const siap = await waitUntilConnected(sock, 'Quiz');
            if (!siap) return;
            const kuisHariIni = QUIZ_BANK[hariAngka.toString()];
            if (kuisHariIni && kuisHariIni.length > 0) {
                const randomQuiz = kuisHariIni[Math.floor(Math.random() * kuisHariIni.length)];
                const sentMsg = await sock.sendMessage(ID_GRUP_TUJUAN, {
                    poll: {
                        name: `🕒 *PULANG SEKOLAH CHECK*\n${randomQuiz.question}`,
                        values: randomQuiz.options,
                        selectableCount: 1
                    }
                });
                fs.writeFileSync(KUIS_PATH, JSON.stringify({
                    msgId: sentMsg.key.id,
                    data: randomQuiz,
                    votes: {},
                    targetJam: jamKirim + 2,
                    tglID: `${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`
                }, null, 2));
                writeLastSent({ [tglID]: true });
            }
        }
    }, 45000);
}

// --- SMART FEEDBACK ---
async function initSmartFeedbackScheduler(sock, botConfig) {
    console.log("✅ Scheduler Smart Feedback Aktif");
    setInterval(async () => {
        if (!botConfig || botConfig.smartFeedback === false) return;
        if (!fs.existsSync(KUIS_PATH)) return;

        let kuisAktif = JSON.parse(fs.readFileSync(KUIS_PATH, 'utf-8'));
        const now = getWIBDate();
        const tglSekarang = `${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`;

        if (isJamKirim(now.getHours(), now.getMinutes(), kuisAktif.targetJam) && kuisAktif.tglID === tglSekarang) {
            const siap = await waitUntilConnected(sock, 'Feedback');
            if (!siap) return;

            const votesArray = Object.values(kuisAktif.votes || {});
            const counts = {};
            votesArray.forEach(v => {
                const pilihan = Array.isArray(v) ? v : [v];
                pilihan.forEach(nama => counts[nama] = (counts[nama] || 0) + 1);
            });

            let maxVotes = 0;
            let winner = "";
            for (const name in counts) {
                if (counts[name] > maxVotes) {
                    maxVotes = counts[name];
                    winner = name;
                }
            }

            if (maxVotes > 0) {
                const idx = kuisAktif.data.options.indexOf(winner);
                const feedback = kuisAktif.data.feedbacks[idx] || "Terima kasih!";
                await sock.sendMessage(ID_GRUP_TUJUAN, { text: `📊 *HASIL POLLING*\nPilihan: *${winner}*\n\n${feedback}` });
            }
            fs.unlinkSync(KUIS_PATH);
        }
    }, 45000);
}

// --- JADWAL BESOK ---
async function initJadwalBesokScheduler(sock, botConfig) {
    console.log("✅ Scheduler Jadwal Besok Aktif (17:00 WIB)");
    setInterval(async () => {
        if (!botConfig || botConfig.jadwalBesok === false) return;
        const now = getWIBDate();
        const tglID = `jadwal-${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`;
        const lastSent = readLastSent();

        if (isJamKirim(now.getHours(), now.getMinutes(), 17) && !lastSent[tglID]) {
            await sendJadwalBesokManual(sock);
            writeLastSent({ [tglID]: true });
        }
    }, 45000);
}

// --- LIST PR MINGGUAN ---
async function initListPrMingguanScheduler(sock, botConfig) {
    console.log("✅ Scheduler List PR Mingguan Aktif");
    setInterval(async () => {
        if (!botConfig || botConfig.prMingguan === false) return;
        const now = getWIBDate();
        const tglID = `pr-minggu-${now.getDate()}-${now.getMonth()}-${now.getFullYear()}`;
        const lastSent = readLastSent();

        if (now.getDay() === 6 && isJamKirim(now.getHours(), now.getMinutes(), 10) && !lastSent[tglID]) {
            if (await isTanggalMerah()) {
                writeLastSent({ [tglID]: true });
                return;
            }
            const { dates, periode } = getWeekDates();
            const currentData = db.getAll() || {};
            let teks = `📌 *DAFTAR LIST TUGAS PR* 📢\n🗓️ Periode: ${periode}\n\n`;
            ['senin', 'selasa', 'rabu', 'kamis', 'jumat'].forEach((h, i) => {
                teks += `📅 *${h.toUpperCase()}* (${dates[i]})\n${currentData[h] || "✅ Tidak ada PR"}\n\n`;
            });
            await sock.sendMessage(ID_GRUP_TUJUAN, { text: teks });
            writeLastSent({ [tglID]: true });
        }
    }, 45000);
}

// --- MANUAL JADWAL ---
async function sendJadwalBesokManual(sock, targetJid) {
    try {
        const siap = await waitUntilConnected(sock, 'JadwalManual');
        if (!siap) return;
        const now = getWIBDate();
        const hariIni = now.getDay();
        if (hariIni === 5 || hariIni === 6) return;
        const hariBesok = hariIni === 0 ? 1 : hariIni + 1;

        const { JADWAL_PELAJARAN, MOTIVASI_SEKOLAH } = require('./constants');
        const { dates } = getWeekDates();
        const tglBesok = dates[hariBesok - 1];
        const currentData = db.getAll() || {};
        const dataPRBesok = currentData[['minggu','senin','selasa','rabu','kamis','jumat','sabtu'][hariBesok]] || "";

        const jadwalFinal = JADWAL_PELAJARAN[hariBesok].split('\n').map(m => {
            const emoji = m.match(/[\u{1F300}-\u{1F9FF}]/u);
            const ada = emoji && dataPRBesok.includes(emoji[0]);
            return `${m} ➝ ${ada ? "ada pr" : "gak ada pr"}`;
        }).join('\n');

        const motivasi = MOTIVASI_SEKOLAH[Math.floor(Math.random() * MOTIVASI_SEKOLAH.length)];
        const formatPesan = `🚀 *PERSIAPAN JADWAL BESOK*\n📅 *${tglBesok}*\n━━━━━━━━━━━━━━━━━━━━\n\n${jadwalFinal}\n\n💡 _"${motivasi}"_`;
        
        await sock.sendMessage(targetJid || ID_GRUP_TUJUAN, { text: formatPesan });
    } catch (err) { console.error("Jadwal Error:", err.message); }
}

module.exports = {
    initQuizScheduler,
    initSmartFeedbackScheduler,
    initJadwalBesokScheduler,
    initListPrMingguanScheduler,
    initSahurScheduler,
    getWeekDates,
    sendJadwalBesokManual
};
        
