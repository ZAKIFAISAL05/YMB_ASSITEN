const { askAI } = require('./ai_handler');
const { handleUserCommands } = require('./features/userHandler');
const { handleAdminCommands } = require('./features/adminHandler');
const fs = require('fs');

// Daftar ID Admin
const ADMIN_RAW = ['6289531549103', '171425214255294', '6285158738155' , '241849843351688' , '254326740103190' , '8474121494667']; 

function getClosestCommand(cmd) {
    const commandsMap = {
        '!menu': '!bantuan',
        '!p': '!cekbot',
        '!pr': '!list_pr',
        '!deadline': '!tugas_lama'
    };

    if (commandsMap[cmd]) return commandsMap[cmd];

    const validCommands = [
        '!cekbot', '!list_pr', '!tugas_lama', '!bantuan', '!jadwal', '!tambah_pr', '!hapus_pr', 
        '!update', '!update_jadwal', '!hapus', '!grup', '!polling', '!info', '!reset-bot', '!data', '!cek_db'
    ];

    if (validCommands.includes(cmd)) return null;

    return validCommands.find(v => {
        const distance = Math.abs(v.length - cmd.length);
        return distance <= 2 && (v.startsWith(cmd.substring(0, 3)) || cmd.startsWith(v.substring(0, 3)));
    });
}

async function handleMessages(sock, m, botConfig, utils) {
    try {
        const msg = m.messages[0];
        if (!msg || !msg.message || msg.key.fromMe) return;

        const sender = msg.key.remoteJid;
        const pushName = msg.pushName || 'User';
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || msg.message.imageMessage?.caption || msg.message.documentMessage?.caption || "").trim();
        if (!body) return;

        const textLower = body.toLowerCase();
        const isAdmin = ADMIN_RAW.some(admin => sender.includes(admin));
        const nonAdminMsg = "🚫 *AKSES DITOLAK*\n\nMaaf, fitur ini hanya bisa diakses oleh *Pengurus*. Kamu bisa gunakan fitur siswa seperti *!list_pr* atau *!bantuan* ya! 😊";

        // Logika AI
        if (textLower.includes('asisten')) {
            await sock.sendPresenceUpdate('composing', sender);
            const response = await askAI(body);
            return await sock.sendMessage(sender, { text: response }, { quoted: msg });
        }

        // Check Format Tanpa Tanda Seru
        const triggers = ['cekbot', 'list_pr', 'tugas_lama', 'bantuan', 'jadwal', 'tambah_pr', 'hapus_pr', 'update', 'update_jadwal', 'hapus', 'grup', 'info', 'data', 'menu', 'pr', 'deadline'];
        const firstWord = textLower.split(' ')[0].replace('!', '');
        
        if (!body.startsWith('!') && triggers.includes(firstWord)) {
            return await sock.sendMessage(sender, { text: `⚠️ *Format Salah!*\n\nGunakan tanda seru (*!*) di depan perintah.\n💡 Contoh: *!bantuan*` });
        }

        if (!body.startsWith('!')) return;

        const args = body.split(' ');
        const cmd = args[0].toLowerCase();

        // --- LOGIKA MENU BANTUAN OTOMATIS ---
        if (cmd === '!bantuan') {
            // Menu dasar untuk semua (Siswa & Admin)
            let menuTeks = 
                `✨ *MENU UTAMA SYTEAM-BOT* ✨\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Halo *${pushName}*! Berikut perintah kamu:\n\n` +
                `📝 *!list_pr* -> Liat daftar PR\n` +
                `📆 *!jadwal* -> Liat jadwal pelajaran\n` +
                `➕ *!tambah_pr* -> Lapor PR baru\n` +
                `🗑️ *!hapus_pr* -> Request hapus PR\n` +
                `⏳ *!tugas_lama* -> PR belum dikumpul\n` +
                `⚡ *!cekbot* -> Cek status bot\n`;

            // Jika ADMIN, tambahkan panduan lengkap di bawahnya
            if (isAdmin) {
                menuTeks += 
                    `\n🛠️ *PANDUAN LENGKAP PENGURUS (ADMIN)*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `✅ *!update [hari] [mapel] [tugas]*\n` +
                    `_Fungsi: Masukin PR ke web/database dan lasung ke kirim ke grup._\n` +
                    `_Contoh: !update senin mtk hal 10_\n\n` +
                    `📢 *!info [pesan]*\n` +
                    `_Fungsi: Kirim pengumuman ke pengumuman y.m.b_\n\n` +
                    `❌ *!hapus [hari] [mapel]*\n` +
                    `_Fungsi: Hapus tugas. Pakai "semua" untuk hapus semua PR di hari itu._\n` +
                    `_Contoh: !hapus senin mtk_\n\n` +
                    `📅 *!update_jadwal [hari] [mapel] [tugas]*\n` +
                    `_Fungsi: Masukin PR ke web/database._\n` +
                    `_Contoh: !update senin mtk hal 10_\n\n` +
                    `📂 *!cek_db*\n` +
                    `_Fungsi: Intip data mentah database._\n`;
            } // <--- SEBELUMNYA KURANG PENUTUP INI

            menuTeks += `\n━━━━━━━━━━━━━━━━━━━━\n_Gunakan tanda ! di depan perintah_`;
            
            return await sock.sendMessage(sender, { text: menuTeks });
        }

        // Routing Perintah Use
        const userCmds = ['!cekbot', '!list_pr', '!tugas_lama', '!jadwal', '!tambah_pr', '!hapus_pr'];
        
        // Routing Perintah Admin
        const adminCmds = ['!update', '!update_jadwal', '!hapus', '!grup', '!info', '!reset-bot', '!data', '!cek_db'];

        if (userCmds.includes(cmd)) {
            await handleUserCommands(sock, msg, cmd, args, utils);
        } else if (adminCmds.includes(cmd)) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: nonAdminMsg });
            await handleAdminCommands(sock, msg, cmd, args, utils, body, nonAdminMsg);
        } else {
            const suggestion = getClosestCommand(cmd);
            if (suggestion) {
                return await sock.sendMessage(sender, { 
                    text: `🧐 *PERINTAH TIDAK DIKENAL*\n━━━━━━━━━━━━━━━━━━━━\nMaksud kamu: *${suggestion}* ?\n\nKetik *!bantuan* untuk melihat menu.` 
                });
            }
        }

    } catch (err) { 
        console.error("Error Main Handler:", err); 
    }
}

module.exports = { handleMessages };
