import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Simple persistent in-memory vector store. Perfect for a POC (a few books).
// Swap this file for Chroma / pgvector / Pinecone later without touching the rest.
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data');
const SEED_FILE = path.join(DIR, 'store.json');
const FILE = process.env.VERCEL
  ? path.join('/tmp', 'ai-mentor-store.json')
  : SEED_FILE;

let db = { documents: [], chunks: [] };

const LOAD_FILE = fs.existsSync(FILE) ? FILE : SEED_FILE;
if (fs.existsSync(LOAD_FILE)) {
  try {
    db = JSON.parse(fs.readFileSync(LOAD_FILE, 'utf-8'));
  } catch {
    console.warn('Could not read store.json, starting empty.');
  }
}

function save() {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db));
}

export function listDocuments() {
  return db.documents;
}

export function addDocument(name, chunks) {
  // Re-uploading the same file name replaces the old version.
  const existing = db.documents.find((d) => d.name === name);
  if (existing) removeDocument(existing.id);

  const id = crypto.randomUUID();
  db.documents.push({ id, name, chunkCount: chunks.length, addedAt: new Date().toISOString() });
  chunks.forEach((c, i) => db.chunks.push({ id: `${id}:${i}`, docId: id, docName: name, ...c }));
  save();
  return db.documents.at(-1);
}

export function removeDocument(id) {
  db.documents = db.documents.filter((d) => d.id !== id);
  db.chunks = db.chunks.filter((c) => c.docId !== id);
  save();
}

/** Vectors are normalized, so cosine similarity is just a dot product. */
export function search(queryEmbedding, k = 6) {
  const scored = db.chunks.map((c) => {
    let dot = 0;
    for (let i = 0; i < queryEmbedding.length; i++) dot += queryEmbedding[i] * c.embedding[i];
    return { ...c, score: dot };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map(({ embedding, ...rest }) => rest);
}
