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

// 發送 LINE 訊息的通用輔助函式 (支援純文字與多媒體訊息)
async function sendLineMessage(replyToken, messageContent) {
    // 判斷傳入的是字串(純文字)還是陣列(Flex Message 等複雜格式)
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

// Webhook 入口
app.post('/webhook', async (req, res) => {
    const events = req.body.events;

    if (events && events.length > 0) {
        for (const event of events) {
            if (event.type === 'message' && event.message.type === 'text') {
                const userId = event.source.userId;
                const userMessage = event.message.text.trim().toLowerCase();
                const replyToken = event.replyToken;

                // 🌟 新增功能：測試 Flex Message 餐廳卡片
                if (userMessage === '查看餐廳') {
                    const flexMessage = {
                        type: "flex",
                        altText: "Brown Cafe 詳細資訊",
                        contents: {
                            "type": "bubble",
                            "hero": {
                                "type": "image",
                                "url": "https://developers-resource.landpress.line.me/fx/img/01_1_cafe.png",
                                "size": "full",
                                "aspectRatio": "20:13",
                                "aspectMode": "cover",
                                "action": { "type": "uri", "uri": "https://line.me/" }
                            },
                            "body": {
                                "type": "box",
                                "layout": "vertical",
                                "contents": [
                                    { "type": "text", "text": "Brown Cafe", "weight": "bold", "size": "xl" },
                                    {
                                        "type": "box", "layout": "baseline", "margin": "md",
                                        "contents": [
                                            { "type": "icon", "size": "sm", "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png" },
                                            { "type": "icon", "size": "sm", "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png" },
                                            { "type": "icon", "size": "sm", "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png" },
                                            { "type": "icon", "size": "sm", "url": "https://developers-resource.landpress.line.me/fx/img/review_gold_star_28.png" },
                                            { "type": "icon", "size": "sm", "url": "https://developers-resource.landpress.line.me/fx/img/review_gray_star_28.png" },
                                            { "type": "text", "text": "4.0", "size": "sm", "color": "#999999", "margin": "md", "flex": 0 }
                                        ]
                                    },
                                    {
                                        "type": "box", "layout": "vertical", "margin": "lg", "spacing": "sm",
                                        "contents": [
                                            {
                                                "type": "box", "layout": "baseline", "spacing": "sm",
                                                "contents": [
                                                    { "type": "text", "text": "Place", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                                    { "type": "text", "text": "Flex Tower, 7-7-4 Midori-ku, Tokyo", "wrap": true, "color": "#666666", "size": "sm", "flex": 5 }
                                                ]
                                            },
                                            {
                                                "type": "box", "layout": "baseline", "spacing": "sm",
                                                "contents": [
                                                    { "type": "text", "text": "Time", "color": "#aaaaaa", "size": "sm", "flex": 1 },
                                                    { "type": "text", "text": "10:00 - 23:00", "wrap": true, "color": "#666666", "size": "sm", "flex": 5 }
                                                ]
                                            }
                                        ]
                                    }
                                ]
                            },
                            "footer": {
                                "type": "box", "layout": "vertical", "spacing": "sm",
                                "contents": [
                                    { "type": "button", "style": "link", "height": "sm", "action": { "type": "uri", "label": "CALL", "uri": "https://line.me/" } },
                                    { "type": "button", "style": "link", "height": "sm", "action": { "type": "uri", "label": "WEBSITE", "uri": "https://line.me/" } },
                                    { "type": "box", "layout": "vertical", "contents": [], "margin": "sm" },
                                    { "type": "button", "action": { "type": "uri", "label": "action", "uri": "http://linecorp.com/" } },
                                    { "type": "button", "action": { "type": "uri", "label": "action", "uri": "http://linecorp.com/" } }
                                ],
                                "flex": 0
                            }
                        }
                    };
                    
                    // 發送陣列格式的 Flex Message
                    await sendLineMessage(replyToken, [flexMessage]);
                    continue;
                }

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
                    const replyText = "📚 提示：遊戲共有五幕，每幕會抽出 3 題。\n只要答對 1 題即可晉級下一幕！\n若 3 題全錯，就會退回起點重新開始喔。\n\n輸入「遊戲開始」挑戰，或輸入「查看餐廳」看精美卡片！";
                    await sendLineMessage(replyToken, replyText);
                    continue;
                }

                // 🌟 進行遊戲作答判定
                const state = userStates[userId];
                
                if (state && ['a', 'b', 'c', 'd'].includes(userMessage)) {
                    const currentQ = state.currentPool[state.questionIndex];
                    
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
                            const replyText = `✅ 答對了！成功晉級！\n\n【第 ${state.stage} 幕】開始！\n${nextQ.question}\n\nA. ${nextQ.options.a}\nB. ${nextQ.options.b}\nC. ${nextQ.options.c}\nD. ${nextQ.options.d}\n\n👉 請作答：`;
                            await sendLineMessage(replyToken, replyText);
                        }
                    } else {
                        state.wrongCount++;
                        
                        if (state.wrongCount >= 3) {
                            delete userStates[userId]; 
                            await sendLineMessage(replyToken, "💀 挑戰失敗...\n你已經在這幕答錯 3 題了，被傳送回原點。\n\n請輸入「遊戲開始」重新挑戰！");
                        } else {
                            state.questionIndex++;
                            const nextQ = state.currentPool[state.questionIndex];
                            const replyText = `❌ 答錯了！\n(目前錯誤：${state.wrongCount}/3)\n\n別氣餒，同一幕的下一題：\n${nextQ.question}\n\nA. ${nextQ.options.a}\nB. ${nextQ.options.b}\nC. ${nextQ.options.c}\nD. ${nextQ.options.d}\n\n👉 請作答：`;
                            await sendLineMessage(replyToken, replyText);
                        }
                    }
                } else {
                    if (state) {
                        await sendLineMessage(replyToken, "💡 遊戲進行中喔！\n請直接輸入 A, B, C 或 D 來回答問題。\n如果要放棄當前遊戲，可以輸入「遊戲開始」重來。");
                    } else {
                        await sendLineMessage(replyToken, "👋 你好！\n請輸入「遊戲開始」來挑戰五幕問答。\n輸入「查看題目」了解規則。\n輸入「查看餐廳」來測試 Flex 卡片！");
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
