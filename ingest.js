import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import 'dotenv/config';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const data = JSON.parse(fs.readFileSync('etpc-data.json', 'utf-8'));

console.log(`A inserir ${data.length} documentos no Supabase...`);

for (const item of data) {
  try {
    const result = await genAI.models.embedContent({
      model: 'text-embedding-004',
      contents: item.content
    });
    const embedding = result.embeddings[0].values;

    const { error } = await supabase.from('documents').insert({
      content: item.content,
      metadata: { source_url: item.source_url, category: item.category },
      embedding: embedding
    });

    if (error) {
      console.error(`❌ Erro ao inserir (${item.category}):`, error.message);
    } else {
      console.log(`✅ Inserido: ${item.category} — ${item.source_url}`);
    }
  } catch (err) {
    console.error(`❌ Falha em "${item.category}":`, err.message);
  }
}

console.log('🎉 Ingestão concluída!');
