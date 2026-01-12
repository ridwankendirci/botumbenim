const TelegramBot = require('node-telegram-bot-api');
const { WebcastPushConnection } = require('tiktok-live-connector');
const config = require('./config');
const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

// Kullanıcı listesi dosya yolu
const USERS_FILE = path.join(__dirname, 'users.json');

// Hata ayıklama modunu açmak için (gerekirse)
// process.env.NTBA_FIX_319 = 1;

let bot;
if (config.telegramBotToken.includes('BURAYA')) {
    console.log("UYARI: Telegram Bot Token ayarlanmamış. Bot başlatılamadı.");
} else {
    bot = new TelegramBot(config.telegramBotToken, { polling: true });
}

// Aktif bağlantıları tutacak obje
const activeConnections = {};

// Spam önlemek için son bildirim zamanlarını tut
const lastNotificationTime = {};

console.log('--- TikTok Takip Botu Başlatılıyor ---');

// Kullanıcıları dosyadan oku
function loadUsers() {
    try {
        if (!fs.existsSync(USERS_FILE)) {
            // Dosya yoksa config'den oluştur
            const initialUsers = config.tiktokUsers || [];
            fs.writeFileSync(USERS_FILE, JSON.stringify(initialUsers, null, 2));
            return initialUsers;
        }
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (err) {
        console.error('Kullanıcı listesi okunamadı:', err);
        return [];
    }
}

// Kullanıcıları dosyaya kaydet
function saveUsers(users) {
    try {
        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('Kullanıcı listesi kaydedilemedi:', err);
    }
}

if (bot) {
    // KOMUTLAR

    // /ekle [kullanici_adi]
    bot.onText(/\/ekle (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const username = match[1].trim(); // Boşlukları temizle

        if (!username) return;

        let users = loadUsers();

        if (users.includes(username)) {
            bot.sendMessage(chatId, `⚠️ <b>${username}</b> zaten takip listesinde.`, { parse_mode: 'HTML' });
            return;
        }

        users.push(username);
        saveUsers(users);

        // Hemen takibe başla
        connectToUser(username);

        bot.sendMessage(chatId, `✅ <b>${username}</b> takip listesine eklendi ve kontrol ediliyor!`, { parse_mode: 'HTML' });
    });

    // /sil [kullanici_adi]
    bot.onText(/\/sil (.+)/, (msg, match) => {
        const chatId = msg.chat.id;
        const username = match[1].trim();

        let users = loadUsers();

        if (!users.includes(username)) {
            bot.sendMessage(chatId, `⚠️ <b>${username}</b> zaten listede yok.`, { parse_mode: 'HTML' });
            return;
        }

        // Listeden çıkar
        users = users.filter(u => u !== username);
        saveUsers(users);

        // Varsa aktif bağlantıyı kes (Hata vermemesi için try-catch veya kontrol)
        if (activeConnections[username]) {
            // Kütüphanede doğrudan disconnect bazen sorun çıkarabilir, referansı siliyoruz
            try {
                activeConnections[username].disconnect();
            } catch (e) { }
            delete activeConnections[username];
        }

        bot.sendMessage(chatId, `🗑️ <b>${username}</b> takip listesinden çıkarıldı.`, { parse_mode: 'HTML' });
    });

    // /liste
    bot.onText(/\/liste/, (msg) => {
        const chatId = msg.chat.id;
        const users = loadUsers();

        if (users.length === 0) {
            bot.sendMessage(chatId, "📭 Takip listesi şu an boş.");
        } else {
            const listStr = users.map(u => `- ${u}`).join('\n');
            bot.sendMessage(chatId, `📋 <b>Takip Edilen Kullanıcılar:</b>\n\n${listStr}`, { parse_mode: 'HTML' });
        }
    });

    // Chat ID bulmak için log (Yine de kalsın)
    bot.on('message', (msg) => {
        if (!msg.text.startsWith('/')) { // Komut olmayan mesajlar
            console.log(`📩 Grup Mesajı (${msg.chat.id}): ${msg.text}`);
        }
    });

    bot.on("polling_error", (msg) => console.log('Telegram Polling Hatası:', msg.code));
}

async function connectToUser(username) {
    if (activeConnections[username]) {
        return;
    }

    const options = {
        processInitialData: false,
        enableWebsocketUpgrade: true,
        clientParams: {
            "app_language": "tr-TR",
            "device_platform": "web_pc"
        }
    };

    if (config.sessionId) {
        options.sessionId = config.sessionId;
        // console.log(`🔑 Session ID kullanılıyor: ${config.sessionId.slice(0, 5)}...`);
    }

    const tiktokLiveConnection = new WebcastPushConnection(username, options);

    try {
        const state = await tiktokLiveConnection.connect();

        console.log(`✅ ${username} şu an YAYINDA! Bağlantı kuruldu.`);
        activeConnections[username] = tiktokLiveConnection;
        sendNotification(username, 'live_started');

        tiktokLiveConnection.on('streamEnd', () => handleDisconnect(username, 'Yayın Bitti'));
        tiktokLiveConnection.on('disconnected', () => handleDisconnect(username, 'Bağlantı Koptu'));
        tiktokLiveConnection.on('error', (err) => handleDisconnect(username, 'Hata'));

    } catch (err) {
        // Yayında değilse veya bağlantı hatası varsa logla
        console.error(`❌ ${username} bağlantı hatası:`, err.message || err);
    }
}

function handleDisconnect(username, reason) {
    if (activeConnections[username]) {
        console.log(`🔴 ${username} koptu: ${reason}`);

        // Sadece 'Yayın Bitti' durumunda bildirim at (disconnect her zaman yayın bittiği anlamına gelmez)
        if (reason === 'Yayın Bitti' || reason === 'StreamEnd') {
            sendNotification(username, 'live_ended');
        }

        delete activeConnections[username];
    }
}

function sendNotification(username, type) {
    if (!bot || config.telegramChatId.includes('BURAYA')) {
        console.log('⚠️ Bildirim gönderilemedi: Bot token veya Chat ID eksik.');
        return;
    }

    const now = Date.now();
    const lastTime = lastNotificationTime[`${username}_${type}`] || 0;

    // 60 saniye spam koruması
    if (now - lastTime < 60000) {
        console.log(`⏳ ${username} için bildirim spam korumasına takıldı.`);
        return;
    }

    lastNotificationTime[`${username}_${type}`] = now;

    let message = '';
    if (type === 'live_started') {
        message = `🚨 <b>${username} YAYINA BAŞLADI!</b>\n\n🔴 İzle: https://www.tiktok.com/@${username}/live`;
    } else {
        message = `🏁 <b>${username} YAYINI KAPATTI.</b>`;
    }

    console.log(`📤 Telegram mesajı gönderiliyor (${config.telegramChatId}): ${message}`);
    bot.sendMessage(config.telegramChatId, message, { parse_mode: 'HTML' }).catch(e => console.error('❌ Telegram mesaj hatası:', e.message));
}

// Ana Başlatıcı
function startApp() {
    const users = loadUsers();
    if (users.length === 0) {
        console.log("⚠️ Takip listesi boş. Telegram grubundan /ekle komutu ile ekleyebilirsiniz.");
    } else {
        console.log(`Takip Listesi: ${users.join(', ')}`);
        users.forEach(user => connectToUser(user));
    }

    // Periyodik kontrol döngüsü (Sadece listede olup bağlantısı olmayanları dene)
    setInterval(() => {
        const currentUsers = loadUsers();
        currentUsers.forEach(user => {
            if (!activeConnections[user]) {
                connectToUser(user);
            }
        });
    }, config.checkInterval);
}

// Cloud platformlarda (Glitch, Replit, Render) uygulamanın ayakta kalması için basit bir sunucu
app.get('/', (req, res) => {
    res.send('TikTok Botu Aktif! 🚀');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
    startApp();
});
