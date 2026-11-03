import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';

export default async function handler(req, res) {
  // Segurança básica: só corre se tiveres um ?token= no URL
  if (req.query.token !== 'etpc2024') {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    // Lê o teu ficheiro de dados (que está na raiz do projeto)
    const data = JSON.parse(fs.readFileSync('etpc-data.json', 'utf-8'));

    // Limpa a tabela para não duplicar
    await supabase.from('documents').delete().neq('id', 0);

    let inseridos = 0;
    for (const item of data) {
      // Usa o modelo novo, corta o vetor para 768 e gera
      const result = await genAI.models.embedContent({
        model: 'gemini-embedding-001',
        contents: item.content,
        config: { outputDimensionality: 768 }
      });
      
      const embedding = result.embeddings[0].values;

      await supabase.from('documents').insert({
        content: item.content,
        metadata: { source_url: item.source_url, category: item.category },
        embedding: embedding
      });
      inseridos++;
    }

    return res.status(200).json({ message: `Sucesso! ${inseridos} documentos inseridos no Supabase.` });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
}
