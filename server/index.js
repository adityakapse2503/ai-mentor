import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { extractPages, cleanPages, chunkPages } from './lib/ingest.js';
import { embedTexts, warmUp } from './lib/embed.js';
import * as store from './lib/store.js';
// import { answerQuestion } from './lib/rag.js';
import { answerQuestion, hasKey } from './lib/rag.js';

console.log('ENV check ->', {
  cwd: process.cwd(),
  provider: process.env.LLM_PROVIDER,
  hasLlmKey: Boolean(process.env.LLM_API_KEY),
});

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN || true }));
app.use(express.json({ limit: '1mb' }));
const readOnly = process.env.READ_ONLY === 'true';
app.use((req, res, next) => {
  if (readOnly && ['POST', 'DELETE'].includes(req.method) && req.path.startsWith('/api/documents')) {
    return res.status(403).json({ error: 'Uploads are disabled in this demo.' });
  }
  next();
});
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: hasKey() });
});

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 60 * 1024 * 1024 } });

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, hasApiKey: Boolean(process.env.ANTHROPIC_API_KEY) });
});

app.get('/api/documents', (_req, res) => res.json(store.listDocuments()));

app.post('/api/documents', upload.array('files', 10), async (req, res) => {
  const results = [];
  for (const file of req.files || []) {
    try {
      const pages = cleanPages(await extractPages(file));
      const chunks = chunkPages(pages);
      if (!chunks.length) throw new Error('No readable text found (scanned PDFs are not supported in this POC).');
      const embeddings = await embedTexts(chunks.map((c) => c.text));
      const doc = store.addDocument(
        file.originalname,
        chunks.map((c, i) => ({ ...c, embedding: embeddings[i] }))
      );
      results.push({ name: file.originalname, ok: true, chunks: doc.chunkCount });
      console.log(`Indexed ${file.originalname}: ${doc.chunkCount} chunks`);
    } catch (err) {
      console.error(err);
      results.push({ name: file.originalname, ok: false, error: err.message });
    }
  }
  res.json({ results, documents: store.listDocuments() });
});

app.delete('/api/documents/:id', (req, res) => {
  store.removeDocument(req.params.id);
  res.json(store.listDocuments());
});

app.post('/api/chat', async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || !messages.length || messages.at(-1).role !== 'user') {
    return res.status(400).json({ error: 'Send { messages: [...] } ending with a user message.' });
  }
  // if (!process.env.ANTHROPIC_API_KEY) {
  //   return res.status(500).json({ error: 'ANTHROPIC_API_KEY is missing in server/.env' });
  // }
  try {
    res.json(await answerQuestion(messages));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Something went wrong.' });
  }
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`AI Mentor server running on http://localhost:${PORT}`);
  warmUp().catch((e) => console.error('Embedding model failed to load:', e.message));
});
