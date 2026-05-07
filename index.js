const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// 🔴 請填入您的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = 'Z1XcJNaA9vsbgUGPw3fFBRENS220e9oJjOzbIiWzxj7WC5EgPh5XPWOGW5ZiII6fz/F03f87r82nNeluYXqggr4E5ll6NIUbKFDPH8vovltUczcWvi0vQNvatLLnklBqRpCyKu4xrtyial2LbCWnhgdB04t89/1O/w1cDnyilFU=';
const BASE_URL = 'https://my-line-bot-4lar.onrender.com'; 

// 安全讀取題庫
let questionsData = {};
function loadQuestions() {
    try {
        if (fs.existsSync('./questions.json')) {
            const raw = fs.readFileSync('./questions.json', 'utf-8');
            questionsData = JSON.parse(raw);
            console.log("✅ 題庫載入成功");
        }
    } catch (e) {
        console.error("❌ 題庫格式錯誤:", e.message);
    }
}
loadQuestions();

const userStates = {};

function getRandomItems(array, n) {
    if (!Array.isArray(array) || array.length === 0) return [];
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, n);
}

async function sendLineMessage(replyToken, messageContent) {
    const messagesArray = Array.isArray(messageContent) ? messageContent : [{ type: 'text', text: messageContent }];
    try {
        await fetch('https://api.line.me/v2/bot/message/reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` },
            body: JSON.stringify({ replyToken, messages: messagesArray.slice(0, 5) })
        });
    } catch (err) {
        console.error("LINE API 發送失敗:", err.message);
    }
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
// 🌟 提供圖片檔案存取路徑
// ==========================================
// 失敗圖片
app.get('/failure.jpg', (req, res) => {
    if (fs.existsSync('./failure.jpg')) res.sendFile(__dirname + '/failure.jpg');
    else res.status(404).send('Not Found');
});

// 成功圖片
app.get('/success.jpg', (req, res) => {
    if (fs.existsSync('./success.jpg')) res.sendFile(__dirname + '/success.jpg');
    else res.status(404).send('Not Found');
});

// 題庫瀏覽網頁
app.get('/view-questions', (req, res) => {
    loadQuestions();
    if (!questionsData["1"]) return res.send("<h1>題庫尚未就緒</h1>");
    let html = `<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>題庫</title><style>body{font-family:sans-serif;padding:20px;background:#f4f4f9;} .q-card{background:white;padding:15px;margin:10px 0;border-radius:8px;box-shadow:0 2px 5px rgba(0,0,0,0.1);}</style></head><body><h1>📚 題庫檢覽</h1>`;
    ["1", "2", "3"].forEach(stage => {
        if(questionsData[stage]) {
            html += `<h2>第 ${stage} 幕</h2>`;
            questionsData[stage].forEach((q, i) => {
                html += `<div class="q-card"><strong>Q${i+1}: ${q.question}</strong><br><small>A:${q.options.a} B:${q.options.b} C:${q.options.c}</small><br><span style="color:red">答案:${q.answer.toUpperCase()}</span></div>`;
            });
        }
    });
    html += `</body></html>`;
    res.send(html);
});

// Webhook
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    if (!events) return res.status(200).send('OK');
    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const userMessage = event.message.text.trim().toLowerCase();
            const replyToken = event.replyToken;

            if (userMessage === '遊戲開始') {
                const selected = getRandomItems(questionsData["1"], 5);
                if (selected.length === 0) return await sendLineMessage(replyToken, "❌ 題庫載入失敗。");
                userStates[userId] = { stage: 1, correctCount: 0, wrongCount: 0, questionIndex: 0, currentPool: selected };
                await sendLineMessage(replyToken, [{ type: 'text', text: '🎮 挑戰開始！每幕隨機抽 5 題，答對 3 題晉級！' }, createQuestionFlex(1, selected[0], 0, 0, 0)]);
            } else if (userMessage === '查看題庫') {
                await sendLineMessage(replyToken, [{
                    type: "flex", altText: "查看題庫",
                    contents: { type: "bubble", body: { type: "box", layout: "vertical", contents: [
                        { type: "text", text: "📚 完整題庫網頁", weight: "bold", size: "lg" },
                        { type: "button", style: "primary", color: "#1DB446", margin: "xl", action: { type: "uri", label: "開啟網頁", uri: `${BASE_URL}/view-questions` }}
                    ]}}
                }]);
            } else {
                const state = userStates[userId];
                if (state && ['a', 'b', 'c'].includes(userMessage)) {
                    const currentQ = state.currentPool[state.questionIndex];
                    const isCorrect = userMessage === currentQ.answer;
                    if (isCorrect) state.correctCount++; else state.wrongCount++;
                    
                    // 🌟 失敗邏輯：答錯 3 題
                    if (state.wrongCount >= 3) {
                        delete userStates[userId];
                        await sendLineMessage(replyToken, [
                            { type: 'text', text: `💀 挑戰失敗！你在本幕已經答錯 3 題了，被傳送回原點。` },
                            {
                                type: 'image',
                                originalContentUrl: `${BASE_URL}/failure.jpg`,
                                previewImageUrl: `${BASE_URL}/failure.jpg`
                            }
                        ]);
                    } else {
                        state.questionIndex++;
                        if (state.questionIndex >= 5) {
                            if (state.correctCount >= 3) {
                                state.stage++;
                                // 🌟 成功通關邏輯：通過全部三幕
                                if (state.stage > 3) {
                                    delete userStates[userId];
                                    await sendLineMessage(replyToken, [
                                        { type: 'text', text: "🎊 太厲害了！你已成功通關全三幕，成為整復推拿達人！" },
                                        {
                                            type: 'image',
                                            originalContentUrl: `${BASE_URL}/success.jpg`, // 讀取你專案內的 success.jpg
                                            previewImageUrl: `${BASE_URL}/success.jpg`
                                        }
                                    ]);
                                } else {
                                    state.currentPool = getRandomItems(questionsData[state.stage.toString()], 5);
                                    state.questionIndex = 0; state.correctCount = 0; state.wrongCount = 0;
                                    await sendLineMessage(replyToken, [{ type: 'text', text: `✅ 晉級第 ${state.stage} 幕！` }, createQuestionFlex(state.stage, state.currentPool[0], 0, 0, 0)]);
                                }
                            } else {
                                // 🌟 失敗邏輯：五題結束但答對不足 3 題
                                delete userStates[userId];
                                await sendLineMessage(replyToken, [
                                    { type: 'text', text: `💔 可惜！答對僅 ${state.correctCount} 題，未達門檻。` },
                                    {
                                        type: 'image',
                                        originalContentUrl: `${BASE_URL}/failure.jpg`,
                                        previewImageUrl: `${BASE_URL}/failure.jpg`
                                    }
                                ]);
                            }
                        } else {
                            await sendLineMessage(replyToken, [{ type: 'text', text: isCorrect ? "✅ 正確！" : "❌ 答錯了！" }, createQuestionFlex(state.stage, state.currentPool[state.questionIndex], state.questionIndex, state.correctCount, state.wrongCount)]);
                        }
                    }
                }
            }
        }
    }
    res.status(200).send('OK');
});

// 圖文選單 Setup
app.get('/setup-menu', async (req, res) => {
    try {
        if (!fs.existsSync('./menu.jpg')) return res.send("<h1>❌ 找不到 menu.jpg</h1>");
        const menuConfig = { size: { width: 1200, height: 810 }, selected: true, name: "Menu", chatBarText: "選單", areas: [
            { bounds: { x: 600, y: 0, width: 600, height: 405 }, action: { type: "message", text: "遊戲開始" } },
            { bounds: { x: 600, y: 405, width: 600, height: 405 }, action: { type: "message", text: "查看題庫" } }
        ]};
        const r1 = await fetch('https://api.line.me/v2/bot/richmenu', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }, body: JSON.stringify(menuConfig)});
        const { richMenuId } = await r1.json();
        await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, { method: 'POST', headers: { 'Content-Type': 'image/jpeg', 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }, body: fs.readFileSync('./menu.jpg')});
        await fetch(`https://api.line.me/v2/bot/user/all/richmenu/${richMenuId}`, { method: 'POST', headers: { 'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}` }});
        res.send(`<h1>✅ 選單成功</h1>`);
    } catch (e) { res.send(`<h1>❌ 錯誤</h1><p>${e.message}</p>`); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server Running"));
