const { askAI } = require('./ai_handler');
const { handleUserCommands } = require('./features/userHandler');
const { handleAdminCommands } = require('./features/adminHandler');
const fs = require('fs');

// Daftar ID Admin
const ADMIN_RAW = ['6289531549103', '171425214255294', '6285158738155', '241849843351688', '254326740103190', '8474121494667']; 

function getClosestCommand(cmd) {
    const commandsMap = {
        'menu': 'bantuan',
        'p': 'cekbot',
        'pr': 'list_pr',
        'deadline': 'tugas_lama',
        'dl': 'tugas_lama',
        'add': 'lapor',
        'tambah': 'lapor',
        'jwl': 'jadwal'
    };

    if (commandsMap[cmd]) return commandsMap[cmd];

    const validCommands = [
        'cekbot', 'list_pr', 'tugas_lama', 'bantuan', 'jadwal', 'lapor', 
        'update', 'update_list_pr', 'hapus', 'info', 'reset-bot', 'cek_db', 'jadwal_baru', 'update_deadline'
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

        // Parsing Command
        const args = body.split(' ');
        const cmd = args[0].toLowerCase().replace('!', '');

        // --- LOGIKA MENU BANTUAN ---
        if (['bantuan', 'menu', 'help'].includes(cmd)) {
            let menuTeks = 
                `✨ *MENU UTAMA SYTEAM-BOT* ✨\n` +
                `━━━━━━━━━━━━━━━━━━━━\n` +
                `Halo *${pushName}*! Berikut perintah kamu:\n\n` +
                `📝 *pr* -> Lihat daftar PR\n` +
                `📆 *jadwal* -> Lihat jadwal pelajaran\n` +
                `📢 *lapor* -> Tambah/Hapus PR (Lapor Admin)\n` +
                `⏳ *deadline* -> PR belum dikumpul\n` +
                `⚡ *p* -> Cek status bot\n`;

            if (isAdmin) {
                menuTeks += 
                    `\n🛠️ *PANDUAN PENGURUS (ADMIN)*\n` +
                    `━━━━━━━━━━━━━━━━━━━━\n` +
                    `✅ *!update [hari] [mapel] [tugas]*\n` +
                    `➝ Update PR & kirim ke grup\n\n` +

                    `📝 *!update_list_pr [hari] [mapel] [tugas]*\n` +
                    `➝ Update PR (Hanya simpan di bot)\n\n` +

                    `📢 *!info [pesan]*\n` +
                    `➝ Kirim pengumuman ke grup\n\n` +

                    `⏳ *!update_deadline [tugas] | [YYYY-MM-DD]*\n` +
                    `➝ Tambah deadline otomatis\n\n` +

                    `❌ *!hapus [hari/deadline] [mapel/semua]*\n` +
                    `➝ Contoh: *!hapus deadline mtk* atau *!hapus senin semua*\n\n` +

                    `🔄 *!jadwal_baru*\n` +
                    `➝ Sinkron ulang semua data\n\n` +

                    `📂 *!cek_db*\n` +
                    `➝ Intip isi semua database\n\n` +

                    `⚙️ *!reset-bot*\n` +
                    `➝ Restart sistem bot\n`;
            } 

            menuTeks += `\n━━━━━━━━━━━━━━━━━━━━\n_Tips: Bisa ketik perintah tanpa tanda (!)_`;
            return await sock.sendMessage(sender, { text: menuTeks });
        }

        // --- ROUTING COMMAND ---
        const userCmds = ['cekbot', 'p', 'list_pr', 'pr', 'tugas_lama', 'deadline', 'dl', 'jadwal', 'jwl', 'lapor', 'tambah'];
        const adminCmds = ['update', 'update_list_pr', 'hapus', 'info', 'reset-bot', 'cek_db', 'jadwal_baru', 'update_deadline'];

        if (userCmds.includes(cmd)) {
            await handleUserCommands(sock, msg, '!' + cmd, args, utils);
        } else if (adminCmds.includes(cmd)) {
            if (!isAdmin) return await sock.sendMessage(sender, { text: nonAdminMsg });
            await handleAdminCommands(sock, msg, '!' + cmd, args, utils, body, nonAdminMsg);
        } else {
            const suggestion = getClosestCommand(cmd);
            if (suggestion) {
                return await sock.sendMessage(sender, { 
                    text: `🧐 *PERINTAH TIDAK DIKENAL*\n━━━━━━━━━━━━━━━━━━━━\nMaksud kamu: *${suggestion}* ?\n\nKetik *menu* untuk melihat daftar perintah.` 
                });
            }
        }

    } catch (err) { 
        console.error("Error Main Handler:", err); 
    }
}

module.exports = { handleMessages };
