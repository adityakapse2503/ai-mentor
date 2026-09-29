import 'dotenv/config';
import app from './app.js';
import { warmUp } from './lib/embed.js';

console.log('ENV check ->', {
  cwd: process.cwd(),
  provider: process.env.LLM_PROVIDER,
  hasLlmKey: Boolean(process.env.LLM_API_KEY),
});

const PORT = process.env.PORT || 8787;
app.listen(PORT, () => {
  console.log(`AI Mentor server running on http://localhost:${PORT}`);
  warmUp().catch((e) => console.error('Embedding model failed to load:', e.message));
});
