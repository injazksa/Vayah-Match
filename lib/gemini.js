import { GoogleGenerativeAI } from '@google/generative-ai';

const MODEL = 'gemini-2.5-flash';

let _gemini = null;
function getGemini() {
  if (!_gemini) {
    _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _gemini;
}

export async function generateAIReply({ systemPrompt, history, userMessage }) {
  const gemini = getGemini();
  const model = gemini.getGenerativeModel({
    model: MODEL,
    systemInstruction: systemPrompt,
    generationConfig: {
      temperature: 0.95,
      topP: 0.95,
      maxOutputTokens: 800,
    },
  });

  // تحويل التاريخ لصيغة Gemini
  const formattedHistory = (history || []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = model.startChat({ history: formattedHistory });
  const result = await chat.sendMessage(userMessage);
  const text = result.response.text();
  return text;
}
