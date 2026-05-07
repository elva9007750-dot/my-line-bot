const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// 🔴 請填入您的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = 'Z1XcJNaA9vsbgUGPw3fFBRENS220e9oJjOzbIiWzxj7WC5EgPh5XPWOGW5ZiII6fz/F03f87r82nNeluYXqggr4E5ll6NIUbKFDPH8vovltUczcWvi0vQNvatLLnklBqRpCyKu4xrtyial2LbCWnhgdB04t89/1O/w1cDnyilFU=';

// 讀取題庫檔案 (questions.json)
const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf-8'));

// 區域對照表
const stageMap = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };

// 儲存所有玩家的遊戲狀態
const userStates = {};

// 隨機抽題的輔助函式
function getRandomQuestions(array, num) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
}

// 發送 LINE 訊息的通用輔助函式
async function sendLineMessage(replyToken, messageContent) {
    const messagesArray = Array.isArray(messageContent) 
        ? messageContent 
        : [{ type: 'text', text: messageContent }];

    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: messagesArray.slice(0, 5) // LINE 限制一次回覆最多 5 則訊息
        })
    });
}

// 🌟 動態產生測驗 Flex Message 卡片
function createQuestionFlex(stage, qData) {
    const stageLabel = stageMap[stage];
    return {
        type: "flex",
        altText: `【第 ${stage} 幕】測驗題目`,
        contents: {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": `【第 ${stage} 幕 - ${stageLabel} 區】測驗題目`,
                        "weight": "bold",
                        "color": "#1DB446",
                        "size": "sm"
                    },
                    {
                        "type": "text",
                        "text": qData.question,
                        "weight": "bold",
                        "size": "xl",
                        "margin": "md",
                        "wrap": true
                    },
                    { "type": "separator", "margin": "xxl" },
                    {
                        "type": "box",
                        "layout": "vertical",
                        "margin": "xxl",
                        "spacing": "sm",
                        "contents": [
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "spacing": "sm",
                                "contents": [
                                    { "type": "button", "style": "secondary", "height": "sm", "action": { "type": "message", "label": `A. ${qData.options.a}`, "text": "a" }, "color": "#F0F0F0" },
                                    { "type": "button", "style": "secondary", "height": "sm", "action": { "type": "message", "label": `B. ${qData.options.b}`, "text": "b" }, "color": "#F0F0F0" }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "spacing": "sm",
                                "contents": [
                                    { "type": "button", "style": "secondary", "height": "sm", "action": { "type": "message", "label": `C. ${qData.options.c}`, "text": "c" }, "color": "#F0F0F0" },
                                    { "type": "button", "style": "secondary", "height": "sm", "action": { "type": "message", "label": `D. ${qData.options.d}`, "text": "d" }, "color": "#F0F0F0" }
                                ]
                            }
                        ]
                    }
                ]
            },
            "styles": { "footer": { "separator": true } }
        }
    };
}

// ==========================================
// 🌟 圖文選單 (Rich Menu) 自動建立 API
// ==========================================
app.get('/setup-menu', async (req, res) => {
    try {
        const menuConfig = {
            size: { width: 1200, height: 810 },
            selected: true,
            name: "遊戲主選單",
            chatBarText: "點我查看功能",
            areas: [
                {
                    // 右上半部：遊戲開始
                    bounds: { x: 600, y: 0, width: 600, height: 405 },
                    action: { type: "message", text: "遊戲開始" }
                },
                {
                    // 右下半部：查看題庫
                    bounds: { x: 600, y: 405, width: 600, height: 405 },
                    action: { type: "message", text: "查看題庫" }
                }
            ]
        };

        const response = await fetch('https://api.line.me/v2/bot/richmenu', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
            body: JSON.stringify(menuConfig)
        });
        const data = await response.json();
        const richMenuId = data.richMenuId;
        
        if (!richMenuId) return res.send(`❌ 建立選單失敗：${JSON.stringify(data)}`);

        // 上傳 menu.jpg (請確保圖片尺寸為 1200x810)
        const imageBuffer = fs.readFileSync('./menu.jpg');
        await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
            body: imageBuffer
        });

        // 設為所有人的預設選單
        await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
        });

        res.send(`<h1>✅ 圖文選單設定成功！</h1><p>RichMenu ID: ${richMenuId}</p>`);
    } catch (error) {
        res.send(`<h1>❌ 錯誤</h1><p>${error.message}</p>`);
    }
});

// ==========================================
// 🌟 遊戲 Webhook 入口
// ==========================================
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    if (!events) return res.status(200).send('OK');

    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const userMessage = event.message.text.trim().toLowerCase();
            const replyToken = event.replyToken;

            // 1. 功能：遊戲開始
            if (userMessage === '遊戲開始') {
                const stageKey = stageMap[1];
                const stageQuestions = getRandomQuestions(questionsData[stageKey], 3);
                userStates[userId] = {
                    stage: 1,
                    wrongCount: 0,
                    currentPool: stageQuestions,
                    questionIndex: 0
                };
                const firstQ = stageQuestions[0];
                await sendLineMessage(replyToken, [
                    { type: 'text', text: '🎮 挑戰開始！請觀察題目後點擊下方選項作答：' },
                    createQuestionFlex(1, firstQ)
                ]);
                continue;
            }

            // 2. 🌟 功能：查看題庫 (一次發送所有區域題目與答案)
            if (userMessage === '查看題庫') {
                const messages = [];
                const zones = ["A", "B", "C", "D", "E"];
                
                zones.forEach(zone => {
                    let zoneText = `📚 【${zone} 區題庫與解答】\n\n`;
                    questionsData[zone].forEach((q, idx) => {
                        const correctText = q.options[q.answer];
                        zoneText += `Q${idx + 1}: ${q.question}\n✅ 答案: (${q.answer.toUpperCase()}) ${correctText}\n\n`;
                    });
                    messages.push({ type: 'text', text: zoneText.trim() });
                });

                await sendLineMessage(replyToken, messages);
                continue;
            }

            // 3. 功能：作答判定
            const state = userStates[userId];
            if (state && ['a', 'b', 'c', 'd'].includes(userMessage)) {
                const currentQ = state.currentPool[state.questionIndex];
                
                if (userMessage === currentQ.answer) {
                    state.stage++;
                    if (state.stage > 5) {
                        delete userStates[userId];
                        await sendLineMessage(replyToken, "🎊 恭喜！您已通過全五幕測驗，成為專業達人！\n\n點選選單「遊戲開始」可再次挑戰。");
                    } else {
                        state.wrongCount = 0;
                        state.questionIndex = 0;
                        const nextKey = stageMap[state.stage];
                        state.currentPool = getRandomQuestions(questionsData[nextKey], 3);
                        const nextQ = state.currentPool[0];
                        await sendLineMessage(replyToken, [
                            { type: 'text', text: `✅ 正確！晉級到第 ${state.stage} 幕 (${nextKey}區)！` },
                            createQuestionFlex(state.stage, nextQ)
                        ]);
                    }
                } else {
                    state.wrongCount++;
                    if (state.wrongCount >= 3) {
                        delete userStates[userId];
                        await sendLineMessage(replyToken, "💀 挑戰失敗！本幕三題全錯，已退回起點。\n\n點選「遊戲開始」重新挑戰！");
                    } else {
                        state.questionIndex++;
                        const nextQ = state.currentPool[state.questionIndex];
                        await sendLineMessage(replyToken, [
                            { type: 'text', text: `❌ 答錯了 (本幕已錯 ${state.wrongCount}/3 次)。請嘗試下一題：` },
                            createQuestionFlex(state.stage, nextQ)
                        ]);
                    }
                }
            } else {
                if (!state) {
                    await sendLineMessage(replyToken, "👋 您好！請點擊下方的圖文選單來開始遊戲或查看題庫！");
                }
            }
        }
    }
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
