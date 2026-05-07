const express = require('express');
const fs = require('fs');
const app = express();
app.use(express.json());

// 🔴 請填入你的 Channel Access Token
const CHANNEL_ACCESS_TOKEN = 'Z1XcJNaA9vsbgUGPw3fFBRENS220e9oJjOzbIiWzxj7WC5EgPh5XPWOGW5ZiII6fz/F03f87r82nNeluYXqggr4E5ll6NIUbKFDPH8vovltUczcWvi0vQNvatLLnklBqRpCyKu4xrtyial2LbCWnhgdB04t89/1O/w1cDnyilFU=';
// 讀取題庫檔案
const questionsData = JSON.parse(fs.readFileSync('./questions.json', 'utf-8'));

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
            messages: messagesArray
        })
    });
}

// 建立或取得特定玩家的狀態
function initUserState(userId) {
    const stage1Questions = getRandomQuestions(questionsData["1"], 3);
    userStates[userId] = {
        stage: 1,
        wrongCount: 0,
        currentPool: stage1Questions,
        questionIndex: 0
    };
}

// 🌟 動態產生測驗 Flex Message 卡片的函式
function createQuestionFlex(stage, qData) {
    return {
        type: "flex",
        altText: `【第 ${stage} 幕】測驗題目：${qData.question}`,
        contents: {
            "type": "bubble",
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": [
                    {
                        "type": "text",
                        "text": `【第 ${stage} 幕】測驗題目`,
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
                                        "action": {
                                            "type": "message",
                                            "label": `A. ${qData.options.a}`,
                                            "text": "a"
                                        },
                                        "color": "#F0F0F0"
                                    },
                                    {
                                        "type": "button",
                                        "style": "secondary",
                                        "height": "sm",
                                        "action": {
                                            "type": "message",
                                            "label": `B. ${qData.options.b}`,
                                            "text": "b"
                                        },
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
                                        "action": {
                                            "type": "message",
                                            "label": `C. ${qData.options.c}`,
                                            "text": "c"
                                        },
                                        "color": "#F0F0F0"
                                    },
                                    {
                                        "type": "button",
                                        "style": "secondary",
                                        "height": "sm",
                                        "action": {
                                            "type": "message",
                                            "label": `D. ${qData.options.d}`,
                                            "text": "d"
                                        },
                                        "color": "#F0F0F0"
                                    }
                                ]
                            }
                        ]
                    }
                ]
            },
            "styles": {
                "footer": {
                    "separator": true
                }
            }
        }
    };
}

// Webhook 入口
app.post('/webhook', async (req, res) => {
    const events = req.body.events;

    if (events && events.length > 0) {
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userId = event.source.userId;
                const userMessage = event.message.text.trim().toLowerCase();
                const replyToken = event.replyToken;

                // 🌟 指令：遊戲開始
                if (userMessage === '遊戲開始') {
                    initUserState(userId);
                    const state = userStates[userId];
                    const firstQ = state.currentPool[0];
                    
                    // 同時發送純文字歡迎語氣與精美的 Flex 題目卡片
                    await sendLineMessage(replyToken, [
                        { type: 'text', text: '🎮 遊戲開始！請點擊下方按鈕作答：' },
                        createQuestionFlex(state.stage, firstQ)
                    ]);
                    continue;
                }

                // 🌟 指令：查看題目
                if (userMessage === '查看題目') {
                    const replyText = "📚 提示：遊戲共有五幕，每幕會抽出 3 題。\n只要答對 1 題即可晉級下一幕！\n若 3 題全錯，就會退回起點重新開始喔。\n\n輸入「遊戲開始」立刻挑戰！";
                    await sendLineMessage(replyToken, replyText);
                    continue;
                }

                // 🌟 進行遊戲作答判定
                const state = userStates[userId];
                
                if (state && ['a', 'b', 'c', 'd'].includes(userMessage)) {
                    const currentQ = state.currentPool[state.questionIndex];
                    
                    // 答對邏輯
                    if (userMessage === currentQ.answer) {
                        state.stage++; 
                        
                        if (state.stage > 5) {
                            delete userStates[userId]; 
                            await sendLineMessage(replyToken, "🎊 恭喜你！！\n你已經突破了所有的五幕關卡，完全通關！\n\n如果想再玩一次，請隨時輸入「遊戲開始」。");
                        } else {
                            state.wrongCount = 0;
                            state.questionIndex = 0;
                            state.currentPool = getRandomQuestions(questionsData[state.stage.toString()], 3);
                            
                            const nextQ = state.currentPool[0];
                            await sendLineMessage(replyToken, [
                                { type: 'text', text: `✅ 答對了！成功晉級到第 ${state.stage} 幕！` },
                                createQuestionFlex(state.stage, nextQ)
                            ]);
                        }
                    } 
                    // 答錯邏輯
                    else {
                        state.wrongCount++;
                        
                        if (state.wrongCount >= 3) {
                            delete userStates[userId]; 
                            await sendLineMessage(replyToken, "💀 挑戰失敗...\n你已經在這幕答錯 3 題了，被傳送回原點。\n\n請輸入「遊戲開始」重新挑戰！");
                        } else {
                            state.questionIndex++;
                            const nextQ = state.currentPool[state.questionIndex];
                            await sendLineMessage(replyToken, [
                                { type: 'text', text: `❌ 答錯了！\n(目前錯誤：${state.wrongCount}/3)\n別氣餒，繼續挑戰同一幕的下一題：` },
                                createQuestionFlex(state.stage, nextQ)
                            ]);
                        }
                    }
                } else {
                    if (state) {
                        await sendLineMessage(replyToken, "💡 遊戲進行中喔！\n請直接點擊上方卡片的按鈕來作答。\n如果要放棄當前遊戲，可以輸入「遊戲開始」重來。");
                    } else {
                        await sendLineMessage(replyToken, "👋 你好！\n請輸入「遊戲開始」來挑戰五幕問答。\n輸入「查看題目」了解規則。");
                    }
                }
            }
        }
    }
    res.status(200).send('OK');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`伺服器已啟動，正在監聽 Port: ${PORT}`);
});
