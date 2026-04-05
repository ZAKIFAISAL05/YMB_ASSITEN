const db = require('../data');
const { MOTIVASI_SEKOLAH } = require('../constants');
// Mengambil data dari file pelajaran yang beda folder
const { MAPEL_CONFIG, STRUKTUR_JADWAL } = require('../pelajaran'); 

// Ganti dengan nomor WA admin (format: 628xxx@s.whatsapp.net)
const ADMIN_NUMBER = '6289531549103@s.whatsapp.net'; 
const HARI_VALID = ['senin', 'selasa', 'rabu', 'kamis', 'jumat'];

async function handleUserCommands(sock, msg, cmd, args, utils) {
    const sender = msg.key.remoteJid;
    const pushName = msg.pushName || 'User';
    const senderNumber = sender.split('@')[0];
    const { dates, periode } = utils.getWeekDates();

    const formatRekap = () => {
        const currentData = db.getAll() || {};
        const motivasi = MOTIVASI_SEKOLAH[Math.floor(Math.random() * MOTIVASI_SEKOLAH.length)];
        let rekap = `📌 *DAFTAR LIST TUGAS PR* 📢\n🗓️ Periode: ${periode}\n\n━━━━━━━━━━━━━━━━━━━━\n\n`;
        
        HARI_VALID.forEach((day, i) => {
            const dayLabelsFull = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
            const dayLabelsSmall = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
            rekap += `📅 *${dayLabelsFull[i]}* (${dates[i]})\n`;
            let tugas = currentData[day];
            
            if (!tugas || tugas.trim() === "" || tugas.toLowerCase().includes("belum ada")) {
                rekap += `└─ ✅ _Tidak ada PR_\n\n`;
            } else { 
                let cleanTugas = tugas.split('\n').filter(line => !line.includes('⏰ Deadline:')).join('\n').trim();
                rekap += `${cleanTugas}\n⏰ Deadline: ${dayLabelsSmall[i]}, ${dates[i]}\n\n`; 
            }
        });
        
        rekap += `━━━━━━━━━━━━━━━━━━━━\n⏳ *BELUM DIKUMPULKAN:*\n${currentData.deadline || "_Semua tugas selesai_."}\n\n💡 _${motivasi}_\n\n⚠️ *Salah/Tambah PR?* Ketik: *lapor [isi]*`;
        return rekap;
    };

    // Bersihkan input command
    const cleanCmd = cmd.replace('!', '').toLowerCase();

    switch (true) {
        case ['cekbot', 'p', 'tes'].includes(cleanCmd):
            await sock.sendMessage(sender, { text: '✅ *Bot Syteam Aktif!* \nKetik *!bantuan* untuk melihat menu.' }); 
            break;

        case ['list_pr', 'pr', 'tugas', 'list'].includes(cleanCmd):
            await sock.sendMessage(sender, { text: formatRekap() }); 
            break;

        case ['jadwal', 'jwl'].includes(cleanCmd):
            const inputHari = args[0]?.toLowerCase();
            let teksJadwal = `📅 *JADWAL PELAJARAN* 📅\n━━━━━━━━━━━━━━━━━━━━\n\n`;
            
            const susunJadwal = (hari) => {
                const listKode = STRUKTUR_JADWAL[hari];
                if (!listKode || listKode.length === 0) return `*${hari.toUpperCase()}*\n_Libur / Tidak ada jadwal._\n\n`;
                
                let hasil = `*${hari.toUpperCase()}*\n`;
                listKode.forEach((kode, index) => {
                    const namaMapel = MAPEL_CONFIG[kode] || kode;
                    hasil += `${index + 1}. ${namaMapel}\n`;
                });
                return hasil + `\n`;
            };

            if (inputHari && HARI_VALID.includes(inputHari)) {
                teksJadwal += susunJadwal(inputHari);
            } else {
                HARI_VALID.forEach((day) => {
                    teksJadwal += susunJadwal(day);
                });
                teksJadwal += `_Tips: Ketik *jadwal [hari]* untuk satu hari saja._\n`;
            }
            
            teksJadwal += `━━━━━━━━━━━━━━━━━━━━`;
            await sock.sendMessage(sender, { text: teksJadwal });
            break;

        case ['lapor', 'lapor_pr', 'tambah', 'hapus'].includes(cleanCmd):
            const isiLaporan = args.join(" ");
            if (!isiLaporan || args.length < 1) {
                return await sock.sendMessage(sender, { 
                    text: "❌ *Format Salah!*\n\nContoh:\n*lapor Senin ada PR MTK*\natau\n*lapor hapus PR hari Selasa*" 
                });
            }

            const pesanLaporan = 
                `┏━━━ « *LAPORAN USER* » ━━━┓\n` +
                `┃\n` +
                `┃ 👤 *Dari:* ${pushName}\n` +
                `┃ 📱 *WA:* ${senderNumber}\n` +
                `┃\n` +
                `┣━━━━━━━━━━━━━━━━━━━━━━\n` +
                `┃ 📝 *ISI PESAN:*\n` +
                `┃ _"${isiLaporan}"_\n` +
                `┃\n` +
                `┗━━━━━━━━━━━━━━━━━━━━━━┛`;

            await sock.sendMessage(ADMIN_NUMBER, { text: pesanLaporan, mentions: [sender] });
            await sock.sendMessage(sender, { text: `✅ *Laporan Terkirim!*\nMakasih *${pushName}*, Admin bakal segera cek pesanmu.` });
            break;

        case ['tugas_lama', 'deadline', 'dl'].includes(cleanCmd):
            const infoDl = (db.getAll() || {}).deadline || "Semua tugas sudah selesai.";
            await sock.sendMessage(sender, { text: `⏳ *DAFTAR TUGAS BELUM DIKUMPULKAN*\n\n${infoDl}` });
            break;
    }
}

module.exports = { handleUserCommands };
