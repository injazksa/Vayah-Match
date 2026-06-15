import { GoogleGenerativeAI } from '@google/generative-ai';

// ترتيب النماذج: نبدأ بـ 2.5 flash، وعند الفشل ننتقل تلقائياً للأكثر استقراراً
const MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash-latest',
  'gemini-1.5-flash',
];

let _gemini = null;
function getGemini() {
  if (!_gemini) {
    _gemini = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  }
  return _gemini;
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// محاولة استدعاء Gemini مع retry تلقائي + fallback بين النماذج
export async function generateAIReply({ systemPrompt, history, userMessage }) {
  const gemini = getGemini();
  const formattedHistory = (history || []).map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  let lastError = null;

  for (const modelName of MODELS) {
    // 3 محاولات لكل نموذج مع تأخير متصاعد
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const model = gemini.getGenerativeModel({
          model: modelName,
          systemInstruction: systemPrompt,
          generationConfig: {
            temperature: 0.95,
            topP: 0.95,
            maxOutputTokens: 800,
          },
        });

        const chat = model.startChat({ history: formattedHistory });
        const result = await chat.sendMessage(userMessage);
        const text = result.response.text();
        console.log(`[Gemini] success with ${modelName} (attempt ${attempt + 1})`);
        return text;
      } catch (e) {
        lastError = e;
        const status = e?.status || e?.statusCode;
        const msg = String(e?.message || '');
        const isOverloaded = status === 503 || status === 429 || msg.includes('overload') || msg.includes('quota') || msg.includes('UNAVAILABLE');

        console.warn(`[Gemini] ${modelName} attempt ${attempt + 1} failed:`, msg.slice(0, 120));

        if (isOverloaded && attempt < 2) {
          // تأخير exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt) * 1000 + Math.random() * 500;
          await sleep(delay);
          continue;
        }
        // إذا لم يكن خطأ تحميل، أو استنفدت المحاولات، انتقل للنموذج التالي
        break;
      }
    }
  }

  // فشلت كل النماذج
  throw new Error(
    'الخدمة مزدحمة حالياً. يرجى المحاولة بعد لحظات. ' +
    (lastError?.message || '')
  );
}
