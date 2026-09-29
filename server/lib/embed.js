import { pipeline } from '@huggingface/transformers';
// Runs fully locally (no API key). The model (~25 MB) is downloaded on first use.
const MODEL = process.env.EMBEDDING_MODEL || "Xenova/all-MiniLM-L6-v2";

let extractorPromise;
function getExtractor() {
  extractorPromise ??= pipeline("feature-extraction", MODEL);
  return extractorPromise;
}

export function warmUp() {
  return getExtractor().then(() =>
    console.log(`Embedding model ready: ${MODEL}`),
  );
}

/** Returns an array of normalized embedding vectors (arrays of numbers). */
export async function embedTexts(texts, batchSize = 16) {
  const extractor = await getExtractor();
  const vectors = [];
  for (let i = 0; i < texts.length; i += batchSize) {
    const out = await extractor(texts.slice(i, i + batchSize), {
      pooling: "mean",
      normalize: true,
    });
    vectors.push(...out.tolist());
  }
  // Round to keep the JSON store small.
  return vectors.map((v) => v.map((x) => Math.round(x * 1e5) / 1e5));
}
