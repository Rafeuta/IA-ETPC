import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido' });
  }

  const { question } = req.body || {};
  if (!question || question.trim().length === 0) {
    return res.status(400).json({ error: 'Pergunta vazia' });
  }

  try {
    // 1. Vetorizar a pergunta
    const embedResult = await genAI.models.embedContent({
      model: 'gemini-embedding-001',
      contents: question,
      config: { outputDimensionality: 768 } // Garante que o tamanho bate certo com o Supabase
    });
    const queryEmbedding = embedResult.embeddings[0].values;

    // 2. Pesquisar fragmentos relevantes no Supabase
    const { data: docs, error } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding,
      match_count: 3
    });

    if (error) throw new Error('Erro na pesquisa vetorial: ' + error.message);

    // 3. Filtrar por similaridade mínima
  const relevantDocs = docs || []; // TESTE: Aceita qualquer resultado (mesmo vazio)

    if (relevantDocs.length === 0) {
      return res.json({
        answer:
          'Não tenho informação suficiente no site da ETPC para responder a essa pergunta. Podes consultar o site oficial em https://etpc.pt para mais informações.',
        sources: []
      });
    }

    // 4. Construir contexto
    const context = relevantDocs
      .map((d) => `[Fonte: ${d.metadata.source_url}]\n${d.content}`)
      .join('\n\n');

    // 5. Chamar Gemini
    const prompt = `És o assistente virtual da ETPC (Escola Técnico-Profissional de Cantanhede).

REGRAS OBRIGATÓRIAS:
1. Responde APENAS com base na informação fornecida abaixo. Não inventes factos.
2. Se a informação não for suficiente, diz claramente: "Não tenho informação suficiente para responder."
3. Se a pergunta for sobre assuntos fora do âmbito da ETPC (futebol, receitas, política, etc.), recusa responder educadamente.
4. No final da resposta, indica o URL da fonte.
5. Responde sempre em português de Portugal.

INFORMAÇÃO DISPONÍVEL:
${context}

PERGUNTA DO UTILIZADOR: ${question}

RESPOSTA:`;

    const result = await genAI.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt
    });

    const answer = result.text;

    // 6. Devolver resposta + fontes
    const sources = [...new Set(relevantDocs.map((d) => d.metadata.source_url))];
    return res.json({ answer, sources });
  } catch (err) {
    console.error('Erro no handler:', err);
    return res.status(500).json({
      error:
        'O assistente está temporariamente indisponível. Tenta novamente mais tarde.',
      detail: err.message
    });
  }
}
