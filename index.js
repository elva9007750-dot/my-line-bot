const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// 🔴 請填入您的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = 'Z1XcJNaA9vsbgUGPw3fFBRENS220e9oJjOzbIiWzxj7WC5EgPh5XPWOGW5ZiII6fz/F03f87r82nNeluYXqggr4E5ll6NIUbKFDPH8vovltUczcWvi0vQNvatLLnklBqRpCyKu4xrtyial2LbCWnhgdB04t89/1O/w1cDnyilFU=';
// 讀取題庫檔案
const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf-8'));

// 區域對照表：將遊戲階段數字轉換為題庫的 A-E 區
const stageMap = { 1: "A", 2: "B", 3: "C", 4: "D", 5: "E" };

// 儲存所有玩家的遊戲狀態 (存在記憶體中)
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
            messages: messagesArray
        })
    });
}

// 建立或取得特定玩家的狀態
function initUserState(userId) {
    // 遊戲開始，從第一幕 (A區) 抽題
    const stageKey = stageMap[1]; // "A"
    const stageQuestions = getRandomQuestions(questionsData[stageKey], 3);
    userStates[userId] = {
        stage: 1,           // 當前幕數 (1-5)
        wrongCount: 0,      // 當前幕累計錯誤
        currentPool: stageQuestions, // 本幕抽出的 3 題
        questionIndex: 0    // 當前回答到第幾題
    };
}

// 🌟 動態產生測驗 Flex Message 卡片
function createQuestionFlex(stage, qData) {
    const stageLabel = stageMap[stage]; // A, B, C, D, E
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
                    {
                        "type": "separator",
                        "margin": "xxl"
                    },
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
                                    {
                                        "type": "button",
                                        "style": "secondary",
                                        "height": "sm",
                                        "action": { "type": "message", "label": `A. ${qData.options.a}`, "text": "a" },
                                        "color": "#F0F0F0"
                                    },
                                    {
                                        "type": "button",
                                        "style": "secondary",
                                        "height": "sm",
                                        "action": { "type": "message", "label": `B. ${qData.options.b}`, "text": "b" },
                                        "color": "#F0F0F0"
                                    }
                                ]
                            },
                            {
                                "type": "box",
                                "layout": "horizontal",
                                "spacing": "sm",
                                "contents": [
                                    {
                                        "type": "button",
                                        "style": "secondary",
                                        "height": "sm",
                                        "action": { "type": "message", "label": `C. ${qData.options.c}`, "text": "c" },
                                        "color": "#F0F0F0"
                                    },
                                    {
                                        "type": "button",
                                        "style": "secondary",
                                        "height": "sm",
                                        "action": { "type": "message", "label": `D. ${qData.options.d}`, "text": "d" },
                                        "color": "#F0F0F0"
                                    }
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
                    // 右下半部：題庫練習
                    bounds: { x: 600, y: 405, width: 600, height: 405 },
                    action: { type: "message", text: "題庫練習" }
                }
            ]
        };

        const res1 = await fetch('https://api.line.me/v2/bot/richmenu', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
            },
            body: JSON.stringify(menuConfig)
        });
        const data1 = await res1.json();
        const richMenuId = data1.richMenuId;
        
        if (!richMenuId) return res.send(`❌ 失敗：${JSON.stringify(data1)}`);

        // 上傳圖片 (確保 menu.jpg 存在)
        const imageBuffer = fs.readFileSync('./menu.jpg');
        await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
            body: imageBuffer
        });

        // 設為預設
        await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
        });

        res.send(`<h1>✅ 成功！</h1><p>選單 ID: ${richMenuId}</p>`);
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

            // 1. 處理：遊戲開始
            if (userMessage === '遊戲開始') {
                initUserState(userId);
                const state = userStates[userId];
                const firstQ = state.currentPool[0];
                await sendLineMessage(replyToken, [
                    { type: 'text', text: '🎮 挑戰開始！請觀察題目後點擊下方選項：' },
                    createQuestionFlex(state.stage, firstQ)
                ]);
                continue;
            }

            // 2. 處理：題庫練習 (顯示規則)
            if (userMessage === '題庫練習') {
                const ruleText = "📚 【闖關規則】\n1. 共 A-E 五個區域，每區隨機抽 3 題。\n2. 只要答對 1 題即晉級下一幕。\n3. 若三題全錯，則退回起點重新挑戰。\n\n點選「遊戲開始」即可進行練習！";
                await sendLineMessage(replyToken, ruleText);
                continue;
            }

            // 3. 處理：作答判定
            const state = userStates[userId];
            if (state && ['a', 'b', 'c', 'd'].includes(userMessage)) {
                const currentQ = state.currentPool[state.questionIndex];
                
                // 答對邏輯
                if (userMessage === currentQ.answer) {
                    state.stage++;
                    if (state.stage > 5) {
                        delete userStates[userId];
                        await sendLineMessage(replyToken, "🎊 恭喜！你已通過全五幕測驗，成為整復推拿達人！\n\n點選選單可重新開始挑戰。");
                    } else {
                        // 晉級下一幕
                        state.wrongCount = 0;
                        state.questionIndex = 0;
                        const nextStageKey = stageMap[state.stage];
                        state.currentPool = getRandomQuestions(questionsData[nextStageKey], 3);
                        const nextQ = state.currentPool[0];
                        await sendLineMessage(replyToken, [
                            { type: 'text', text
