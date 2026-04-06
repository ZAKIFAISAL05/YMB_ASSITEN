Const ID_GRUP_TUJUAN = '120363403625197368@g.us'; 

// 🔗 LINK FOLDER KHUSUS KISI-KISI
// Silakan ganti link di bawah ini dengan link Google Drive kamu yang sebenarnya
const LINK_FOLDER_KISIKISI = 'https://drive.google.com/drive/folders/1STfjwjZioRCk-77rp5HGA617WgxTFCzn';

function getWIBDate() {
    return new Date(new Date().toLocaleString("en-US", {timeZone: "Asia/Jakarta"}));
}

// --- FUNGSI UTAMA PENGINGAT TKA ---
async function initTkaScheduler(sock, botConfig) {
    console.log("✅ Scheduler Pengingat Ujian TKA Aktif (File Terpisah)");
    let lastSentDate = ""; 

    const tkaInterval = setInterval(async () => {
        if (!botConfig || botConfig.quiz === false) return; 

        const now = getWIBDate();
        const jam = now.getHours();
        const menit = now.getMinutes();
        const tglID = `${now.getDate()}-${now.getMonth() + 1}-${now.getFullYear()}`;
        
        const tanggal = now.getDate();
        const bulan = now.getMonth() + 1;

        // -----------------------------------------------------------
        // 🔒 SISTEM MATI OTOMATIS (AUTO-KILL)
        // Mati pas tanggal 7 April jam 12 siang setelah ujian selesai
        // -----------------------------------------------------------
        if (bulan === 4 && tanggal >= 7 && jam >= 12) {
            console.log("🛑 Ujian TKA Selesai. Fitur tkaReminder otomatis dimatikan!");
            clearInterval(tkaInterval); 
            return;
        }

        // Pengaman jika tahun sudah lewat dari 2026 atau bulan lewat dari April
        if (now.getFullYear() > 2026 || bulan > 4) {
            clearInterval(tkaInterval);
            return;
        }

        // -----------------------------------------------------------
        // 1. PERIODE: SEKARANG s.d 5 APRIL (Kirim Jam 16:30 WIB)
        // -----------------------------------------------------------
        if (bulan === 4 && tanggal <= 5 && jam === 16 && menit === 30 && lastSentDate !== tglID) {
            try {
                const sisaHari = 6 - tanggal;
                
                // KOLEKSI PESAN MURNI TKA (REDOAM) YANG BANYAK
                const listPesan = [
                    `🔔 *PULANG SEKOLAH CHECK* 🔔\n\nGimana sekolahnya hari ini? Capek ya? Istirahat dulu yuk! Oiya, jangan lupa *H-${sisaHari} Menuju Ujian TKA*. Sempatkan baca rangkuman di Drive ya! 📚✨`,
                    `🎒 *WAKTUNYA PULANG!* 🎒\n\nRapikan tas kamu, hati-hati di jalan ya! Pengingat kecil: *Sisa ${sisaHari} hari lagi* kita tempur di Ujian TKA. Yuk dicicil belajarnya biar gak sistem kebut semalam! 🔥`,
                    `🌅 *PULANG SEKOLAH REMINDER* 🌅\n\nSelamat beristirahat teman-teman! Manfaatkan waktu sore ini buat rileks ya. Inget, *H-${sisaHari} lagi Ujian TKA*. Semangat terus belajarnya! 💪🎯`,
                    `📚 *STUDY REMINDER SORE* 📚\n\nWah gak terasa ya sisa *${sisaHari} hari lagi* menuju TKA. Gak usah panik dan stress, yang penting konsisten belajarnya walau cuma 15 menit. Semangat kawan! ✊`,
                    `🍃 *PULANG SEKOLAH DULU GUYS!* 🍃\n\nYuk letakkan tas dulu, minum air putih yang banyak. Otak butuh istirahat sebelum tempur TKA *H-${sisaHari} lagi*. Jangan lupa jaga kesehatan ya! 😇`,
                    `🔥 *COUNTDOWN TKA: H-${sisaHari}* 🔥\n\nPulang sekolah ini coba luangkan waktu sebentar buat review materi yang susah ya. Usaha tidak akan mengkhianati hasil kok. Kita pasti bisa lulus bareng-bareng! 💯`,
                    `🌟 *SAPAAN SORE PENYEMANGAT* 🌟\n\nSatu hari lagi terlewati menuju medan perang TKA (*H-${sisaHari}*). Bangga banget sama perjuangan kalian sejauh ini. Ayo tuntaskan sampai hari H! 🏆`,
                    `⏰ *PENGINGAT WAKTU SORE* ⏰\n\nJangan lupa bernapas ya saking sibuknya ngerjain tugas, hehe. Pengingat: *Tinggal ${sisaHari} hari lagi* menuju TKA. Manfaatkan waktu sebaik mungkin! 🚀`,
                    `🔋 *CAS ENERGI DULU* 🔋\n\nPulang sekolah waktunya istirahat biar fokus lagi belajarnya nanti malam. Inget, perjuangan tinggal *${sisaHari} hari lagi* sebelum TKA dimulai! 🥊`,
                    `🌈 *SEMANGAT TERUS KAWAN!* 🌈\n\nHari ini mungkin capek, tapi bayangin senangnya kita nanti kalau sukses TKA bareng-bareng. Ayo maksimalkan sisa *H-${sisaHari}* ini sebaik mungkin! 👊`
                ];
                
                const teksRandom = listPesan[Math.floor(Math.random() * listPesan.length)];
                
                // Tambahkan info folder khusus kisi-kisi dengan peringatan tegas
                const teksLengkap = teksRandom + `\n\n📁 *INFO KISI-KISI TKA:* \nBuat kalian yang dapet kisi-kisi (khususnya *MTK & B. Indo*), tolong bantu kumpulin ke folder ini ya:\n${LINK_FOLDER_KISIKISI}\n\n⚠️ _Catatan: Dilarang upload file aneh di luar kisi-kisi!_`;
                
                await sock.sendMessage(ID_GRUP_TUJUAN, { text: teksLengkap });
                lastSentDate = tglID;
            } catch (err) { console.error("Error Pengingat Sore TKA:", err); }
        }

        // -----------------------------------------------------------
        // 2. TANGGAL 5 APRIL MALAM (Kirim Jam 17:00 WIB)
        // -----------------------------------------------------------
        if (bulan === 4 && tanggal === 5 && jam === 17 && menit === 0 && lastSentDate !== tglID) {
            try {
                const listPesanMalam = [
                    `🔥 *BISMILLAH, H-1 UJIAN TKA!* 🔥\n━━━━━━━━━━━━━━━━━━━━\n\nTeman-teman kelas, besok perjuangan kita dimulai. Malam ini STOP belajar terlalu keras! \n\nIstirahatkan otak kalian, tidur lebih awal, dan siapkan mental. Apapun yang sudah kita pelajari, semoga besok keluar di soal. Jangan lupa minta restu orang tua ya. \n\n*Kita berjuang bareng-bareng, kita sukses bareng-bareng! Semangat!* ✊🌟\n\n━━━━━━━━━━━━━━━━━━━━\n_Gak usah tegang, kita pasti bisa!_ 😇`,
                    `🌙 *H-1 UJIAN TKA: WAKTUNYA RILEKS* 🌙\n━━━━━━━━━━━━━━━━━━━━\n\nMalam ini gak ada materi baru lagi yang perlu dibaca. Tutup bukunya, rapikan alat tulisnya. \n\nMari kita serahkan sisanya kepada doa dan usaha yang udah kita lakuin berhari-hari kemarin. Tidur nyenyak malam ini, dan mari kita tunjukkan kemampuan terbaik kita besok pagi! \n\n*Semangat tempur kawan-kawan!* 🔥💪\n\n━━━━━━━━━━━━━━━━━━━━\n_Usaha sudah, tinggal doa yang kencang!_ ✨`,
                    `🚩 *FINAL COUNTDOWN: BESOK TKA!* 🚩\n━━━━━━━━━━━━━━━━━━━━\n\nMalam terakhir sebelum ujian! Gak kerasa ya perjuangan kita udah sejauh ini. \n\nMalam ini jangan begadang ya, pastikan besok bangun dengan badan yang seger. Jangan lupa siapin seragam dan kartu ujiannya dari sekarang biar gak buru-buru besok. \n\n*Doa terbaik buat kita semua, semoga lancar ngerjainnya!* 🎯💯\n\n━━━━━━━━━━━━━━━━━━━━\n_Semoga dimudahkan segalanya besok!_ 😇`
                ];

                const teksRandomMalam = listPesanMalam[Math.floor(Math.random() * listPesanMalam.length)];
                await sock.sendMessage(ID_GRUP_TUJUAN, { text: teksRandomMalam });
                lastSentDate = tglID;
            } catch (err) { console.error("Error Malam TKA:", err); }
        }

        // -----------------------------------------------------------
        // 3. MULAI TANGGAL 6 APRIL DST (Kirim Jam 06:00 Pagi)
        // -----------------------------------------------------------
        if (bulan === 4 && tanggal >= 6 && jam === 6 && menit === 0 && lastSentDate !== tglID) {
            try {
                const listSemangatPagi = [
                    `☀️ *SELAMAT PAGI PEJUANG TKA!* ☀️\n\nHari baru, semangat baru! Jangan lupa sarapan biar otak ada tenaganya. Baca doa sebelum mulai mengisi ya. Semoga nilai kita memuaskan! 💯🔥`,
                    `🚀 *READY FOR TODAY? GO!* 🚀\n\nYuk tegakkan badan, tarik napas dalam-dalam. Kita sudah belajar semampu kita, sekarang waktunya eksekusi! Fokus dan teliti ya ngerjainnya. Semangat! ✊✨`,
                    `🌈 *SAY HELLO TO SUCCESS!* 🌈\n\nJangan panik kalau ketemu soal susah. Kerjain yang mudah dulu. Percaya sama kemampuan diri sendiri. Sukses buat ujian hari ini kawan! 🎯💪`
                ];
                
                const teksSemangat = listSemangatPagi[Math.floor(Math.random() * listSemangatPagi.length)];
                await sock.sendMessage(ID_GRUP_TUJUAN, { text: teksSemangat });
                lastSentDate = tglID;
            } catch (err) { console.error("Error Pagi TKA:", err); }
        }

        // -----------------------------------------------------------
        // 4. PENAMBAHAN: TANGGAL 6 APRIL SORE (Kirim Jam 15:00 WIB)
        // -----------------------------------------------------------
        if (bulan === 4 && tanggal === 6 && jam === 15 && menit === 0 && lastSentDate !== tglID) {
            try {
                const pesanBIndo = `📚 *REMINDER BELAJAR BAHASA INDONESIA* 📚\n\nYuk teman-teman, luangkan waktu sore ini buat belajar Bahasa Indonesia! Target kita nilai Bahasa Indonesia harus lebih tinggi untuk mendongkrak nilai MTK yang kemarin dirasa kecil atau sulit. Kita maksimalkan di sini ya, semangat belajarnya! 🔥🎯`;
                
                await sock.sendMessage(ID_GRUP_TUJUAN, { text: pesanBIndo });
                lastSentDate = tglID;
            } catch (err) { console.error("Error Pengingat B.Indo:", err); }
        }

        // -----------------------------------------------------------
        // 5. PENAMBAHAN: TANGGAL 7 APRIL PAGI (Kirim Jam 05:50 WIB)
        // -----------------------------------------------------------
        if (bulan === 4 && tanggal === 7 && jam === 5 && menit === 50 && lastSentDate !== tglID) {
            try {
                const pesanPagiTerakhir = `☀️ *SEMANGAT HARI TERAKHIR TKA!* ☀️\n\nSelamat pagi pejuang! Tarik napas dalam-dalam, hari ini adalah medan perang terakhir kita di TKA. Yuk keluarkan semua kemampuan terbaik kita untuk melewati ujian pamungkas ini. Sedikit lagi tuntas, ayo semangat sampai akhir! ✊🔥`;
                
                await sock.sendMessage(ID_GRUP_TUJUAN, { text: pesanPagiTerakhir });
                lastSentDate = tglID;
            } catch (err) { console.error("Error Pagi Terakhir TKA:", err); }
        }

        // -----------------------------------------------------------
        // 6. PENAMBAHAN: TANGGAL 7 APRIL SIANG (Kirim Jam 11:00 WIB)
        // -----------------------------------------------------------
        if (bulan === 4 && tanggal === 7 && jam === 11 && menit === 0 && lastSentDate !== tglID) {
            try {
                const pesanSelesaiTka = `🎉 *ALHAMDULILLAH, SELESAI UJIAN!* 🎉\n━━━━━━━━━━━━━━━━━━━━\n\nSelamat kawan-kawan! Kita semua sudah berhasil melewati rangkaian Ujian TKA ini dengan tangguh. \n\nSoal nilai atau hasil akhir gak usah terlalu dipikirkan dulu sekarang. Walaupun tadi mungkin ada soal yang tidak dimengerti atau dirasa sulit, yang terpenting kita sudah berusaha maksimal. Tetap semangat dan mari kita rayakan perjuangan hebat kita ini! 🥳🙌\n\n━━━━━━━━━━━━━━━━━━━━\n_Istirahat yang nyenyak, kalian luar biasa!_ ✨`;
                
                await sock.sendMessage(ID_GRUP_TUJUAN, { text: pesanSelesaiTka });
                lastSentDate = tglID;
            } catch (err) { console.error("Error Selesai TKA:", err); }
        }

    }, 35000); 
}

module.exports = { initTkaScheduler };
