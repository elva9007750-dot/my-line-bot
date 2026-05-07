const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// 🔴 請填入你的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = 'Z1XcJNaA9vsbgUGPw3fFBRENS220e9oJjOzbIiWzxj7WC5EgPh5XPWOGW5ZiII6fz/F03f87r82nNeluYXqggr4E5ll6NIUbKFDPH8vovltUczcWvi0vQNvatLLnklBqRpCyKu4xrtyial2LbCWnhgdB04t89/1O/w1cDnyilFU=';
// 讀取題庫檔案
const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf-8'));

// 儲存所有玩家的遊戲狀態 (存在記憶體中)
const userStates = {};

// 隨機抽題的輔助函式
function getRandomQuestions(array, num) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, num);
}

// 發送 LINE 訊息的輔助函式
async function sendLineMessage(replyToken, text) {
    await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${CHANNEL_ACCESS_TOKEN}`
        },
        body: JSON.stringify({
            replyToken: replyToken,
            messages: [{ type: 'text', text: text }]
        })
    });
}

// 建立或取得特定玩家的狀態
function initUserState(userId) {
    // 從第一幕開始，錯0題，抽 3 題準備
    const stage1Questions = getRandomQuestions(questionsData["1"], 3);
    userStates[userId] = {
        stage: 1,           // 第幾幕 (1~5)
        wrongCount: 0,      // 累計錯誤次數
        currentPool: stage1Questions, // 當前抽出來的 3 題
        questionIndex: 0    // 現在正在回答這 3 題中的第幾題 (0, 1, 2)
    };
}

// Webhook 入口
app.post('/webhook', async (req, res) => {
    const events = req.body.events;

    if (events && events.length > 0) {
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userId = event.source.userId;
                const userMessage = event.message.text.trim().toLowerCase(); // 轉小寫方便判斷 a, b, c, d
                const replyToken = event.replyToken;

                // 🌟 指令：遊戲開始
                if (userMessage === '遊戲開始') {
                    initUserState(userId);
                    const state = userStates[userId];
                    const firstQ = state.currentPool[0];
                    const replyText = `🎮 遊戲開始！\n\n【第 1 幕】\n${firstQ.question}\n\nA. ${firstQ.options.a}\nB. ${firstQ.options.b}\nC. ${firstQ.options.c}\nD. ${firstQ.options.d}\n\n👉 請直接輸入 A, B, C 或 D 作答！`;
                    await sendLineMessage(replyToken, replyText);
                    continue;
                }

                // 🌟 指令：查看題目
                if (userMessage === '查看題目') {
                    const replyText = "📚 提示：遊戲共有五幕，每幕會抽出 3 題。\n只要答對 1 題即可晉級下一幕！\n若 3 題全錯，就會退回起點重新開始喔。\n\n準備好的話，請輸入「遊戲開始」！";
                    await sendLineMessage(replyToken, replyText);
                    continue;
                }

                // 🌟 進行遊戲作答判定
                const state = userStates[userId];
                
                // 如果玩家有狀態，且輸入的是 a, b, c, d 之一
                if (state && ['a', 'b', 'c', 'd'].includes(userMessage)) {
                    const currentQ = state.currentPool[state.questionIndex];
                    
                    // 答對了！(只要對 1 題就晉級)
                    if (userMessage === currentQ.answer) {
                        state.stage++; // 進入下一幕
                        
                        // 檢查是否通關第五幕
                        if (state.stage > 5) {
                            delete userStates[userId]; // 清除狀態
                            await sendLineMessage(replyToken, "🎊 恭喜你！！\n你已經突破了所有的五幕關卡，完全通關！\n\n如果想再玩一次，請隨時輸入「遊戲開始」。");
                        } else {
                            // 準備下一幕的題目
                            state.wrongCount = 0;
                            state.questionIndex = 0;
                            state.currentPool = getRandomQuestions(questionsData[state.stage.toString()], 3);
                            
                            const nextQ = state.currentPool[0];
                            const replyText = `✅ 答對了！成功晉級！\n\n【第 ${state.stage} 幕】開始！\n${nextQ.question}\n\nA. ${nextQ.options.a}\nB. ${nextQ.options.b}\nC. ${nextQ.options.c}\nD. ${nextQ.options.d}\n\n👉 請作答：`;
                            await sendLineMessage(replyToken, replyText);
                        }
                    } 
                    // 答錯了！
                    else {
                        state.wrongCount++;
                        
                        // 失敗條件：錯滿 3 題
                        if (state.wrongCount >= 3) {
                            delete userStates[userId]; // 清除狀態
                            await sendLineMessage(replyToken, "💀 挑戰失敗...\n你已經在這幕答錯 3 題了，被傳送回原點。\n\n請輸入「遊戲開始」重新挑戰！");
                        } else {
                            // 沒死，前往同幕的下一題
                            state.questionIndex++;
                            const nextQ = state.currentPool[state.questionIndex];
                            const replyText = `❌ 答錯了！\n(目前錯誤：${state.wrongCount}/3)\n\n別氣餒，同一幕的下一題：\n${nextQ.question}\n\nA. ${nextQ.options.a}\nB. ${nextQ.options.b}\nC. ${nextQ.options.c}\nD. ${nextQ.options.d}\n\n👉 請作答：`;
                            await sendLineMessage(replyToken, replyText);
                        }
                    }
                } 
                // 若玩家還沒開始遊戲，或者亂打字
                else {
                    if (state) {
                        await sendLineMessage(replyToken, "💡 遊戲進行中喔！\n請直接輸入 A, B, C 或 D 來回答問題。\n如果要放棄當前遊戲，可以輸入「遊戲開始」重來。");
                    } else {
                        await sendLineMessage(replyToken, "👋 你好！\n請輸入「遊戲開始」來挑戰五幕問答，或輸入「查看題目」了解規則。");
                    }
                }
            }
        }
    }
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`遊戲伺服器已啟動，正在監聽 Port: ${PORT}`);
});
