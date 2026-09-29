import path from 'path';
import pdf from 'pdf-parse/lib/pdf-parse.js';

const CHUNK_SIZE = Number(process.env.CHUNK_SIZE) || 900;
const OVERLAP = Number(process.env.CHUNK_OVERLAP) || 150;

// Detects headings like "Chapter 3", "CHAPTER IV.", "Book II", "Part 1".
// const CHAPTER_RE = /^(chapter|book|part|section)\s+([ivxlcdm]+|\d+)\b/i;
const CHAPTER_RE = /^(chapter|book|part|section)\s+([ivxlcdm]+|\d+)\b/i;
const STORY_RE = /^[IVX]{1,5}\.\s+[A-Z][A-Za-z'’“” ,\-]{2,60}$/;
const isHeading = (line) => line.length < 80 && (CHAPTER_RE.test(line) || STORY_RE.test(line));
/** Extract text as an array of { page, text }. */
export async function extractPages(file) {
  const ext = path.extname(file.originalname).toLowerCase();

  if (ext === '.pdf') {
    const pages = [];
    await pdf(file.buffer, {
      // Called once per page, in order, so we can keep page numbers.
      pagerender: async (pageData) => {
        const content = await pageData.getTextContent();
        let text = '';
        let lastY;
        for (const item of content.items) {
          const y = item.transform[5];
          text += lastY === undefined || lastY === y ? item.str : '\n' + item.str;
          lastY = y;
        }
        pages.push({ page: pages.length + 1, text });
        return text;
      },
    });
    return pages;
  }

  if (ext === '.txt' || ext === '.md') {
    return [{ page: null, text: file.buffer.toString('utf-8') }];
  }

  throw new Error(`Unsupported file type: ${ext}. Use PDF, TXT or MD.`);
}

/** Remove page numbers and running headers/footers that repeat on many pages. */
export function cleanPages(pages) {
  if (pages.length < 6) return pages;
  const freq = new Map();
  for (const { text } of pages) {
    const seen = new Set(text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && l.length < 60));
    for (const l of seen) freq.set(l, (freq.get(l) || 0) + 1);
  }
  const limit = Math.max(3, pages.length * 0.3);
  return pages.map(({ page, text }) => ({
    page,
    text: text
      .split(/\r?\n/)
      .filter((raw) => {
        const l = raw.trim();
        if (/^\d{1,4}$/.test(l)) return false; // bare page numbers
        return !((freq.get(l) || 0) > limit);
      })
      .join('\n'),
  }));
}

/**
 * Chapter-aware chunking. Chunks never cross a chapter heading,
 * end on sentence boundaries where possible, and overlap slightly.
 * Each chunk keeps { chapter, page } metadata for citations.
 */
export function chunkPages(pages) {
  const chunks = [];
  let chapter = 'Introduction';
  let buf = '';
  let bufPage = pages[0]?.page ?? null;

  const emit = (text) => {
    const t = text.trim();
    if (t.length > 80) chunks.push({ text: t, chapter, page: bufPage });
  };

  for (const { page, text } of pages) {
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;

      if (isHeading(line)) {
        emit(buf);
        buf = '';
        chapter = line.replace(/\s+/g, ' ');
        bufPage = page;
        continue;
      }

      if (!buf) bufPage = page;
      buf += (buf ? ' ' : '') + line;

      // A single long line can hold several chunks' worth of text, so loop.
      while (buf.length >= CHUNK_SIZE) {
        let cut = buf.lastIndexOf('. ', CHUNK_SIZE + 100);
        if (cut > CHUNK_SIZE * 0.6) cut += 1;
        else {
          cut = buf.lastIndexOf(' ', CHUNK_SIZE);
          if (cut < CHUNK_SIZE * 0.6) cut = CHUNK_SIZE;
        }
        emit(buf.slice(0, cut));
        buf = (buf.slice(Math.max(0, cut - OVERLAP), cut) + ' ' + buf.slice(cut)).trim();
        bufPage = page;
        if (buf.length <= OVERLAP + 1) break;
      }
    }
  }
  emit(buf);
  return chunks;
}
