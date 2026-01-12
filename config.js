module.exports = {
    // Telegram Bot Token (BotFather'dan alınan)
    // Örnek: '123456789:ABCdefGHIjklMNOpqrsTUVwxyz'
    telegramBotToken: '8441370266:AAELZLfQyno9pr-9mwHacA-E1AHQ-bRsmgE',

    // Mesajların gönderileceği Grup ID'si
    // Botu çalıştırdıktan sonra gruba bir mesaj atın, konsolda ID görünecektir.
    // Örnek: -1001234567890
    telegramChatId: '-5130008593',

    // Takip edilecek TikTok kullanıcı adları
    tiktokUsers: [
        'akc042',
        // 'baska_kullanici_adi',
    ],

    // Kontrol sıklığı (milisaniye cinsinden). 
    // Kullanıcı yayında değilse, kaç saniyede bir tekrar kontrol edilsin?
    // 60000 = 1 dakika (Önerilen)
    checkInterval: 60000
};
