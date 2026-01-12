module.exports = {
    // Telegram Bot Token
    // Render'da 'TELEGRAM_TOKEN' adıyla Environment Variable olarak ekleyebilirsiniz.
    telegramBotToken: process.env.TELEGRAM_TOKEN || '8441370266:AAELZLfQyno9pr-9mwHacA-E1AHQ-bRsmgE',

    // Mesajların gönderileceği Grup ID'si
    // Render'da 'CHAT_ID' adıyla Environment Variable olarak ekleyebilirsiniz.
    telegramChatId: process.env.CHAT_ID || '-5130008593',

    // Takip edilecek TikTok kullanıcı adları
    // Render'da users.json sıfırlanabilir, bu yüzden ana listeyi burada tutmak daha güvenlidir.
    tiktokUsers: [
        'akc042',
        // 'baska_kullanici_adi',
    ],

    // Kontrol sıklığı
    checkInterval: 60000,

    // TikTok Session ID (Render'da 'SESSION_ID' olarak ekleyin)
    // TikTok sürekli giriş isteyebileceği için bu cookie çok önemlidir.
    sessionId: process.env.SESSION_ID || ''
};
