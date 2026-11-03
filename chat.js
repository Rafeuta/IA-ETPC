import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido' });

  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: 'Pergunta vazia' });

  try {
    // Liga-se à IA
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    
    // O modelo mais estável e rápido
    const result = await genAI.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: 'Tu és o assistente da ETPC. Responde a isto de forma simples: ' + question
    });

    return res.json({ answer: result.text, sources: [] });

  } catch (err) {
    console.error('ERRO:', err);
    // Se der erro, mostra o erro exato no chat para sabermos o que é
    return res.status(500).json({ error: 'Erro da IA: ' + err.message });
  }
}
