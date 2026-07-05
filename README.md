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
INFERENCE_API_KEY=...   # Inference inference key (sk-inf-v1..., not sk-mgmt-v1...)
INFERENCE_BASE_URL=https://model.service-inference.ai/v1
INFERENCE_MODEL=deepseek-chat
```

⚠️ A **management key** (`sk-mgmt-v1-...`) can list usage/cost data but **cannot run completions** (401). Use an *inference* API key (`sk-inf-v1-...`) for the app. Until then, every route degrades gracefully to warm, hand-written fallback content — the demo is fully walkable either way.

Optional, for live Inference.ai Seedance video generation (off the demo critical path):

```
INFERENCE_VIDEO_MODEL=dreamina-seedance-2-0-260128
INFERENCE_VIDEO_DURATION=4
INFERENCE_VIDEO_RESOLUTION=480p
INFERENCE_VIDEO_RATIO=16:9
INFERENCE_VIDEO_AUDIO=false
NEXT_PUBLIC_SITE_URL=https://your-deployed-app.example.com
# Optional: reuse an existing asset group instead of creating one per request.
INFERENCE_ASSET_GROUP_ID=group-...
```

For a reference doll image, Inference.ai needs a public image URL. Local
`/dolls/*.png` paths only work after deployment, when `NEXT_PUBLIC_SITE_URL`
points at a reachable host. Without that, the live route still works as a
text-to-video prompt based on the generated story.

If `/video/generate` returns `403 Model ... is not available to your account`,
the request format is fine but the model is not enabled for that inference key.
Ask Inference.ai to enable `dreamina-seedance-2-0-260128`, or set
`INFERENCE_VIDEO_MODEL` to a model your account can use.

## How it's put together

- **Next.js 16 (App Router) + TypeScript + Tailwind 4**, Vercel AI SDK → Inference.ai (`deepseek-chat`).
- `data/dolls.json` — the 8 available "Park Friends" + Chloe, built from the real Shopify catalog (names, prices, personalities, product photos in `public/dolls/`). Ella is sold out and excluded.
- API routes (server-side only; the key never reaches the client):
  - `POST /api/chat` — streams each warm gift-finder question.
  - `POST /api/recommend` — `generateObject` (zod) → exactly 3 real dolls with reasons; keyword-match fallback.
  - `POST /api/story` — streams the personalized chapter-one story; template fallback.
  - `POST /api/generate-video` — live Inference.ai Seedance submit→poll→download proof.
  - `GET /api/generate-video/status?taskId=...&dollId=...` — poll a long-running video task and save the finished clip.
- `public/videos/{id}.mp4` / `{id}-full.mp4` — cached story clips (Ken Burns over real product photos, cliffhanger end cards). Regenerate with `node scripts/gen_videos.mjs`.

## Demo script (fixed persona)

1. Landing → **Find your child's friend**.
2. Answer: `Emma` → `5` → `birthday` → `shy and gentle, loves bedtime stories and tea parties`.
3. Pick **Wren** → story streams starring Emma & Wren → play the video (ends "To be continued…").
4. **Bring Wren home** → mock confirm + outfit upsell (free shipping at $75).
5. Scan/click the QR → `/unlock/wren` → chapter-two clip → "Meet the next friend."
