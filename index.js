const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// 🔴 請填入您的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = 'Z1XcJNaA9vsbgUGPw3fFBRENS220e9oJjOzbIiWzxj7WC5EgPh5XPWOGW5ZiII6fz/F03f87r82nNeluYXqggr4E5ll6NIUbKFDPH8vovltUczcWvi0vQNvatLLnklBqRpCyKu4xrtyial2LbCWnhgdB04t89/1O/w1cDnyilFU=';

// 讀取題庫檔案
const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf-8'));

// 儲存玩家狀態
const userStates = {};

// 隨機抽題函式：從陣列中隨機取出 N 個不重複元素
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

// 建立測驗 Flex Message
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
                    { type: "text", text: `【第 ${stage} 幕】進度：${qIndex + 1} / 5 (目前 ${correct} 對 ${wrong} 錯)`, weight: "bold", color: "#1DB446", size: "xs" },
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

// Webhook
app.post('/webhook', async (req, res) => {
    const events = req.body.events;
    if (!events) return res.status(200).send('OK');

    for (const event of events) {
        if (event.type === 'message' && event.message.type === 'text') {
            const userId = event.source.userId;
            const userMessage = event.message.text.trim().toLowerCase();
            const replyToken = event.replyToken;

            // 1. 遊戲開始：從第 1 幕分類中隨機抽 5 題
            if (userMessage === '遊戲開始') {
                const selectedQuestions = getRandomItems(questionsData["1"], 5);
                userStates[userId] = {
                    stage: 1,
                    correctCount: 0,
                    wrongCount: 0,
                    questionIndex: 0,
                    currentPool: selectedQuestions
                };
                await sendLineMessage(replyToken, [
                    { type: 'text', text: '🎮 挑戰開始！共有三幕，每幕會隨機從題庫抽出 5 題，答對 3 題即可晉級！' },
                    createQuestionFlex(1, selectedQuestions[0], 0, 0, 0)
                ]);
                continue;
            }

            // 2. 查看題庫 (簡易規則說明)
            if (userMessage === '查看題庫') {
                await sendLineMessage(replyToken, "📚 【專業題庫訓練】\n目前題庫已載入超過 100 題，分為三幕挑戰。\n每次開始都會隨機出題，快點擊「遊戲開始」來測試吧！");
                continue;
            }

            // 3. 答題邏輯
            const state = userStates[userId];
            if (state && ['a', 'b', 'c'].includes(userMessage)) {
                const currentQ = state.currentPool[state.questionIndex];
                const isCorrect = userMessage === currentQ.answer;

                if (isCorrect) state.correctCount++;
                else state.wrongCount++;

                // 檢查是否「立即失敗」(錯 3 題)
                if (state.wrongCount >= 3) {
                    delete userStates[userId];
                    await sendLineMessage(replyToken, `💀 挑戰失敗！你在本幕已經答錯 3 題了。\n請點擊「遊戲開始」重新挑戰！`);
                    continue;
                }

                state.questionIndex++;

                // 檢查一幕是否結束 (滿 5 題)
                if (state.questionIndex >= 5) {
                    if (state.correctCount >= 3) {
                        state.stage++;
                        if (state.stage > 3) {
                            delete userStates[userId];
                            await sendLineMessage(replyToken, "🎊 恭喜通關！你已成功通過全部三幕的考驗！");
                        } else {
                            // 晉級下一幕：重新隨機抽 5 題
                            const nextStage = state.stage.toString();
                            state.currentPool = getRandomItems(questionsData[nextStage], 5);
                            state.questionIndex = 0;
                            state.correctCount = 0;
                            state.wrongCount = 0;
                            await sendLineMessage(replyToken, [
                                { type: 'text', text: `✅ 恭喜！本幕達標，現在進入第 ${state.stage} 幕！` },
                                createQuestionFlex(state.stage, state.currentPool[0], 0, 0, 0)
                            ]);
                        }
                    } else {
                        delete userStates[userId];
                        await sendLineMessage(replyToken, `💔 可惜！本幕答對數不足 3 題，挑戰結束。`);
                    }
                } else {
                    // 繼續下一題
                    const nextQ = state.currentPool[state.questionIndex];
                    const feedback = isCorrect ? "✅ 正確！" : "❌ 答錯了！";
                    await sendLineMessage(replyToken, [
                        { type: 'text', text: `${feedback} 下一題：` },
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
            size: { width: 1200, height: 810 }, selected: true, name: "主選單", chatBarText: "點我",
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
        res.send("✅ 選單設定完成");
    } catch (e) { res.send("❌ " + e.message); }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server is running.`));
