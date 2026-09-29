# AI Mentor (RAG POC)

An AI mentor that answers **only** from the books or documents you upload, cites the exact passages it used, and refuses when the knowledge base doesn't cover the question.

**Stack:** React (Vite) + Tailwind CSS v4 · Node/Express · local embeddings (`all-MiniLM-L6-v2` via transformers.js) · JSON vector store · Claude for generation.

## Setup

Requires Node.js 18+.

```bash
npm run install:all
cp server/.env.example server/.env     # then put your ANTHROPIC_API_KEY in server/.env
npm run dev
```

Open http://localhost:5173, upload PDF/TXT/MD files in the **Knowledge base** panel, then ask questions.

The first upload downloads the ~25 MB embedding model (one time, then it runs offline).

Good test books (public domain, plain TXT from gutenberg.org): *Meditations*, *The Art of War*, *The Prince*.

## How it works

```
Upload -> extract text (per page) -> clean headers/page numbers -> chapter-aware chunks
       -> local embeddings -> server/data/store.json

Question -> embed -> cosine top-K -> guardrail 1 (score < MIN_SCORE => refuse, no LLM call)
         -> Claude with numbered passages, "use only this context, cite [n]"
         -> guardrail 2 (model replies NOT_IN_KB => refuse)
         -> answer + only the passages it actually cited
```

| File | Role |
|---|---|
| `server/lib/ingest.js` | PDF/TXT/MD extraction, cleaning, chapter-aware chunking with page + chapter metadata |
| `server/lib/embed.js` | Local embeddings |
| `server/lib/store.js` | Vector store (swap for Chroma/pgvector later) |
| `server/lib/rag.js` | Retrieval, grounded prompt, refusal + citation logic |
| `client/src/components/*` | Library panel, chat, citation badges, expandable sources |

## Tuning (server/.env)

| Variable | Effect |
|---|---|
| `MIN_SCORE` | Retrieval refusal threshold (default 0.25). Raise it if off-topic questions get answered; lower it if valid questions are refused. |
| `TOP_K` | Passages sent to the LLM (default 6) |
| `CHUNK_SIZE` / `CHUNK_OVERLAP` | Chunking (default 900 / 150 characters) |
| `ANTHROPIC_MODEL` | Claude model used for answers |

## Known POC limits

- Scanned/image PDFs are not supported (no OCR).
- Chapter detection looks for headings like "Chapter 3" / "Book II" / "Part 1"; other formats fall back to "Introduction".
- RAG can't erase the LLM's pretrained knowledge. Grounding is enforced by prompt, refusal guardrails and visible citations. Measure it with an evaluation set (recall@5, faithfulness, correct refusal).
- Vector store is in-memory JSON: fine for a few books, not for large corpora.
