const QUIZ_BANK = {
    // 1. SENIN: TKA MATEMATIKA
    1: [
        { 
            question: "Gimana tadi TKA Matematika-nya? Angka-angkanya aman?", 
            options: ["Lancar Jaya", "Agak Pusing", "Selesai Semua", "Bismillah Bagus"], 
            feedbacks: ["Keren! Logika kamu emang juara. 📐", "Gak apa-apa, yang penting sudah usaha maksimal! 🔢", "Mantap! Lega banget kan kalau sudah selesai. ✅", "Amin! Hasil tidak akan mengkhianati proses. 🙏"] 
        },
        { 
            question: "Soal mana yang menurutmu paling menantang tadi?", 
            options: ["Aljabar", "Geometri", "Statistika", "Semua Menantang"], 
            feedbacks: ["Aljabar memang butuh ketelitian tinggi! 🧠", "Geometri melatih imajinasi visual kamu, mantap! 📏", "Data dan angka emang seru buat diulik ya. 📊", "Kamu hebat bisa melewati semuanya! 🏆"] 
        }
    ],

    // 2. SELASA: TKA BAHASA INDONESIA
    2: [
        { 
            question: "Hari kedua TKA Bahasa Indonesia! Tadi bacaannya panjang-panjang ya?", 
            options: ["Lumayan", "Bisa Dipahami", "Fokus Baca", "Selesai Tepat Waktu"], 
            feedbacks: ["Literasi kamu kuat banget, mantap! 📖", "Paham teks itu kunci nilai bagus di BIND. ✨", "Fokus adalah kekuatan utama kamu hari ini. 🎯", "Manajemen waktu yang bagus! ⏱️"] 
        },
        { 
            question: "Gimana perasaanmu setelah menyelesaikan ujian hari ini?", 
            options: ["Lega", "Optimis", "Mau Istirahat", "Siap Belajar Lagi"], 
            feedbacks: ["Satu beban terangkat! Selamat istirahat sejenak. 😊", "Keyakinan adalah awal dari kesuksesan! 🌟", "Rebahan dulu biar otak fresh lagi. 🛌", "Semangat belajarnya jangan kendor ya! 🔥"] 
        }
    ],

    // 3. RABU: BELAJAR DI RUMAH
    3: [
        { 
            question: "Hari pertama Belajar di Rumah. Udah mulai cicil materi buat besok?", 
            options: ["Lagi Baca", "Ngerjain Latihan", "Nonton Tutorial", "Istirahat Dulu"], 
            feedbacks: ["Pintar! Belajar mandiri itu melatih disiplin. 📚", "Latihan soal bikin kamu makin terbiasa. ✍️", "Visualisasi materi lewat video emang lebih asik! 💻", "Jangan lupa atur waktu istirahat juga ya. 🔋"] 
        }
    ],

    // 4. KAMIS: BELAJAR DI RUMAH
    4: [
        { 
            question: "Masih semangat Belajar di Rumah? Ada kendala materi gak?", 
            options: ["Lancar", "Tanya Teman", "Cari di Google", "Masih Paham"], 
            feedbacks: ["Kemandirian kamu luar biasa! 🚀", "Diskusi bareng temen emang bikin cepat paham. 🗣️", "Manfaatkan teknologi buat nambah ilmu, keren! 🌐", "Pertahankan fokusnya, dikit lagi selesai! 🎯"] 
        }
    ],

    // 5. JUMAT: BELAJAR DI RUMAH & PERSIAPAN PEKAN DEPAN
    5: [
        { 
            question: "Jumat Berkah! Tetap produktif meski belajar dari rumah?", 
            options: ["Iya Dong", "Agak Santai", "Fokus Review", "Siap Weekend"], 
            feedbacks: ["Itu baru semangat murid teladan! ✨", "Santai sejenak boleh, yang penting tetap progres. ☕", "Review ulang bikin materi makin nempel di otak. 🧠", "Selamat menyambut akhir pekan setelah berjuang! 🏁"] 
        }
    ]
};

// Jangan lupa tambahkan module export di paling bawah agar bisa dibaca scheduler.js
module.exports = { QUIZ_BANK };
