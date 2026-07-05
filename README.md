# Apple Park — "Meet Your New Best Friend"

SEA Hacks prototype: an AI buying experience for [Apple Park Kids](https://appleparkkids.com) that reframes the purchase from "browse a catalog" to "meet the friend you're giving a child."

**Flow:** Landing → conversational gift-finder (4 questions) → 3 real matching dolls → pick one → personalized "Meet [Doll]" storybook page with streamed story + story video that ends on a cliffhanger → mock QR unlock → next-chapter teaser.

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:3000 and click **Find your child's friend**.

### Environment

`.env.local` (gitignored):

```
INFERENCE_API_KEY=...   # Inference.net INFERENCE key (not a management key)
```

⚠️ The key currently in `.env`/`.env.local` is a **management key** (`sk-mgmt-…`) — it can list models but **cannot run completions** (401). Create an *inference* API key in the [Inference.net dashboard](https://inference.net) and replace it. Until then, every route degrades gracefully to warm, hand-written fallback content — the demo is fully walkable either way.

Optional, for live Seedance video generation (off the demo critical path):

```
SEEDANCE_API_KEY=...
SEEDANCE_API_BASE=...   # HolyCrab or any Seedance 2.0 provider
```

## How it's put together

- **Next.js 16 (App Router) + TypeScript + Tailwind 4**, Vercel AI SDK → Inference.net (`meta-llama/llama-3.3-70b-instruct/fp-8`).
- `data/dolls.json` — the 8 available "Park Friends" + Chloe, built from the real Shopify catalog (names, prices, personalities, product photos in `public/dolls/`). Ella is sold out and excluded.
- API routes (server-side only; the key never reaches the client):
  - `POST /api/chat` — streams each warm gift-finder question.
  - `POST /api/recommend` — `generateObject` (zod) → exactly 3 real dolls with reasons; keyword-match fallback.
  - `POST /api/story` — streams the personalized chapter-one story; template fallback.
  - `POST /api/generate-video` — live Seedance submit→poll→download proof (501 until configured).
- `public/videos/{id}.mp4` / `{id}-full.mp4` — cached story clips (Ken Burns over real product photos, cliffhanger end cards). Regenerate with `node scripts/gen_videos.mjs`.

## Demo script (fixed persona)

1. Landing → **Find your child's friend**.
2. Answer: `Emma` → `5` → `birthday` → `shy and gentle, loves bedtime stories and tea parties`.
3. Pick **Wren** → story streams starring Emma & Wren → play the video (ends "To be continued…").
4. **Bring Wren home** → mock confirm + outfit upsell (free shipping at $75).
5. Scan/click the QR → `/unlock/wren` → chapter-two clip → "Meet the next friend."
