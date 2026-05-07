const express = require('express');
const app = express();

// 讓伺服器能夠解析 LINE 傳來的 JSON 資料
app.use(express.json());

// 🔴 請在這裡填寫你剛剛提供的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = '請將這段文字替換成你的_Token';

// 建立一個接收 LINE 訊息的入口 (Webhook)
app.post('/webhook', async (req, res) => {
    const events = req.body.events;

    if (events && events.length > 0) {
        for (const event of events) {
            // 確認是文字訊息
            if (event.type === 'message' && event.message.type === 'text') {
                const userMessage = event.message.text.trim();

                // 判斷是否輸入「安安」
                if (userMessage === '安安') {
                    const replyData = {
                        replyToken: event.replyToken,
                        messages: [{ type: 'text', text: '寶貝安安' }]
                    };

                    try {
                        // 主動呼叫 LINE API 回覆訊息
                        await fetch('https://api.line.me/v2/bot/message/reply', {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
                            },
                            body: JSON.stringify(replyData)
                        });
                    } catch (error) {
                        console.error('發送失敗:', error);
                    }
                }
            }
        }
    }
    // 必須回傳 200 給 LINE，否則 LINE 會判定失敗
    res.status(200).send('OK');
});

// 啟動伺服器 (Render 會自動分配 Port 給我們)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器已啟動，正在監聽 Port: ${PORT}`);
});
