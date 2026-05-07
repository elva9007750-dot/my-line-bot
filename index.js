const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// 🔴 請填入您的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = 'Z1XcJNaA9vsbgUGPw3fFBRENS220e9oJjOzbIiWzxj7WC5EgPh5XPWOGW5ZiII6fz/F03f87r82nNeluYXqggr4E5ll6NIUbKFDPH8vovltUczcWvi0vQNvatLLnklBqRpCyKu4xrtyial2LbCWnhgdB04t89/1O/w1cDnyilFU=';
const BASE_URL = 'https://my-line-bot-4lar.onrender.com'; // 您的伺服器網址

// 讀取題庫檔案
const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf-8'));

// 儲存玩家狀態
const userStates = {};

// 隨機抽題函式
function getRandomItems(array, n) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

// 發送 LINE 訊息
async function sendLineMessage(replyToken, messageContent) {
    const messagesArray = Array.isArray(messageContent) ? messageContent : [{ type: 'text', text: messageContent }];
    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
        body: JSON.stringify({ replyToken, messages: messagesArray.slice(0, 5) })
    });
}

// 測驗題目 Flex Message
function createQuestionFlex(stage, qData, qIndex, correct, wrong) {
    const createOptionItem = (letter, text) => ({
        type: "box", layout: "vertical", paddingAll: "lg", backgroundColor: "#F0F0F0", cornerRadius: "md", margin: "md",
        action: { type: "message", label: text, text: letter },
        contents: [{ type: "text", text: `${letter.toUpperCase()}. ${text}`, wrap: true, size: "md", color: "#333333" }]
    });

    return {
        type: "flex",
        altText: `【第 ${stage} 幕】第 ${qIndex + 1} 題`,
        contents: {
            type: "bubble",
            body: {
                type: "box", layout: "vertical",
                contents: [
                    { type: "text", text: `【第 ${stage} 幕】進度：${qIndex + 1} / 5 (本幕錯 ${wrong}/3)`, weight: "bold", color: "#1DB446", size: "xs" },
                    { type: "text", text: qData.question, weight: "bold", size: "xl", margin: "md", wrap: true },
                    { type: "separator", margin: "xxl" },
                    {
                        type: "box", layout: "vertical", margin: "xxl", spacing: "sm",
                        contents: [
                            createOptionItem("a", qData.options.a),
                            createOptionItem("b", qData.options.b),
                            createOptionItem("c", qData.options.c)
                        ]
                    }
                ]
            }
        }
    };
}

// ==========================================
// 🌟 題庫瀏覽網頁 (HTML)
// ==========================================
app.get('/view-questions', (req, res) => {
    let html = `
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>專業整復推拿題庫</title>
        <style>
            body { font-family: sans-serif; line-height: 1.6; padding: 20px; background: #f4f4f9; color: #333; }
            h1 { color: #1DB446; text-align: center; }
            .stage-title { background: #1DB446; color: white; padding: 10px; margin-top: 30px; border-radius: 5px; }
            .q-card { background: white; padding: 15px; margin: 15px 0; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .ans { color: #d9534f; font-weight: bold; margin-top: 5px; }
            .options { font-size: 0.9em; color: #666; }
        </style>
    </head>
    <body>
        <h1>📚 完整題庫檢覽</h1>
    `;

    ["1", "2", "3"].forEach(stage => {
        html += `<h2 class="stage-title">第 ${stage} 幕題庫</h2>`;
        questionsData[stage].forEach((q, index) => {
            html += `
            <div class="q-card">
                <strong>Q${index + 1}: ${q.question}</strong>
                <div class="options">A: ${q.options.a} | B: ${q.options.b} | C: ${q.options.c}</div>
                <div class="ans">正確答案：${q.answer.toUpperCase()}</div>
            </div>`;
        });
    });

    html += `</body></html>`;
    res.send(html);
});

// ==========================================
// 🌟 Webhook 主邏輯
// ==========================================
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    if (!events) return res.status(200).send('OK');

    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const userMessage = event.message.text.trim().toLowerCase();
            const replyToken = event.replyToken;

            // 1. 遊戲開始
            if (userMessage === '遊戲開始') {
                const selectedQuestions = getRandomItems(questionsData["1"], 5);
                userStates[userId] = { stage: 1, correctCount: 0, wrongCount: 0, questionIndex: 0, currentPool: selectedQuestions };
                await sendLineMessage(replyToken, [
                    { type: 'text', text: '🎮 挑戰開始！共有三幕，每幕隨機抽 5 題，答對 3 題晉級！' },
                    createQuestionFlex(1, selectedQuestions[0], 0, 0, 0)
                ]);
                continue;
            }

            // 2. 查看題庫：改為傳送網頁連結
            if (userMessage === '查看題庫') {
                const flexLink = {
                    type: "flex",
                    altText: "點擊查看完整題庫",
                    contents: {
                        type: "bubble",
                        body: {
                            type: "box", layout: "vertical",
                            contents: [
                                { type: "text", text: "📚 完整題庫內容", weight: "bold", size: "lg" },
                                { type: "text", text: "點擊下方按鈕即可在網頁查看全部題目與解答。", margin: "md", wrap: true, color: "#666666" },
                                {
                                    type: "button", style: "primary", color: "#1DB446", margin: "xl",
                                    action: { type: "uri", label: "開啟題庫網頁", uri: `${BASE_URL}/view-questions` }
                                }
                            ]
                        }
                    }
                };
                await sendLineMessage(replyToken, [flexLink]);
                continue;
            }

            // 3. 答題判斷
            const state = userStates[userId];
            if (state && ['a', 'b', 'c'].includes(userMessage)) {
                const currentQ = state.currentPool[state.questionIndex];
                const isCorrect = userMessage === currentQ.answer;

                if (isCorrect) state.correctCount++;
                else state.wrongCount++;

                if (state.wrongCount >= 3) {
                    delete userStates[userId];
                    await sendLineMessage(replyToken, `💀 挑戰失敗！你在本幕已錯 3 題。\n請重新點擊「遊戲開始」。`);
                    continue;
                }

                state.questionIndex++;

                if (state.questionIndex >= 5) {
                    if (state.correctCount >= 3) {
                        state.stage++;
                        if (state.stage > 3) {
                            delete userStates[userId];
                            await sendLineMessage(replyToken, "🎊 恭喜通關！你已成功通過全部考驗！");
                        } else {
                            const nextStage = state.stage.toString();
                            state.currentPool = getRandomItems(questionsData[nextStage], 5);
                            state.questionIndex = 0; state.correctCount = 0; state.wrongCount = 0;
                            await sendLineMessage(replyToken, [
                                { type: 'text', text: `✅ 達標！進入第 ${state.stage} 幕！` },
                                createQuestionFlex(state.stage, state.currentPool[0], 0, 0, 0)
                            ]);
                        }
                    } else {
                        delete userStates[userId];
                        await sendLineMessage(replyToken, `💔 可惜！本幕答對僅 ${state.correctCount} 題，未達 3 題門檻。`);
                    }
                } else {
                    const nextQ = state.currentPool[state.questionIndex];
                    const feedback = isCorrect ? "✅ 正確！" : "❌ 答錯了！";
                    await sendLineMessage(replyToken, [
                        { type: 'text', text: feedback },
                        createQuestionFlex(state.stage, nextQ, state.questionIndex, state.correctCount, state.wrongCount)
                    ]);
                }
            }
        }
    }
    res.status(200).send('OK');
});

// 圖文選單 API
app.get('/setup-menu', async (req, res) => {
    try {
        const menuConfig = {
            size: { width: 1200, height: 810 }, selected: true, name: "主選單", chatBarText: "選單",
            areas: [
                { bounds: { x: 600, y: 0, width: 600, height: 405 }, action: { type: "message", text: "遊戲開始" } },
                { bounds: { x: 600, y: 405, width: 600, height: 405 }, action: { type: "message", text: "查看題庫" } }
            ]
        };
        const r1 = await fetch('https://api.line.me/v2/bot/richmenu', {
            method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
            body: JSON.stringify(menuConfig)
        });
        const d1 = await r1.json();
        const rid = d1.richMenuId;
        const img = fs.readFileSync('./menu.jpg');
        await fetch(`https://api-data.line.me/v2/bot/richmenu/${rid}/content`, {
            method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
            body: img
        });
        await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${rid}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }
        });
        res.send("✅ 選單 OK");
    } catch (e) { res.send("❌ " + e.message); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running.`));
