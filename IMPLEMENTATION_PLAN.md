# Apple Park "Meet [Doll]" — Implementation Plan

## Context
SEA Hacks one-day sprint (submissions **due 3:30 PM today, July 5**; 1-min demo video + 3-min pitch for finalists). We're building the Apple Park Kids industry-track prototype: an AI buying experience that reframes the purchase from "browse a catalog grid" to "meet the friend you're giving a child." Flow: faithful landing → conversational gift-finder → 3 real matching dolls → pick one → personalized "Meet [Doll]" story page with a cached story video that cuts on a cliffhanger, plus a mocked QR unlock + next-chapter teaser for the repeat-purchase pitch.

This plan supersedes the original `plan.md` where verified facts broke its assumptions (below).

## Verified constraints (these changed the plan)
- **Inference.net = LLM inference only** (OpenAI-compatible, base `https://api.inference.net/v1`). It does **NOT** generate images or video, and does **not** host DeepSeek. Use it for all text/LLM work with the existing key. Confirmed model: `google/gemma-3-27b-instruct/bf-16` (browse the playground for a stronger hosted instruct model, e.g. a Llama-70b, and prefer it if available; Gemma is the safe fallback).
- **No DeepSeek** — story + recommendation text come from the Inference.net hosted LLM.
- **Video = ByteDance Seedance 2.0 via HolyCrab**, async job (submit→poll→download), **30–120s per clip**. Too slow for live generation → **pre-generate demo clips and cache in `/public/videos/`**. Wire a real generate endpoint as "works live too" proof, but keep it OFF the demo critical path. If HolyCrab's API proves flaky, any Seedance provider (PiAPI, fal.ai) is a drop-in fallback — the deliverable is just an mp4 in `/public`.
- **No image generation needed** — use Apple Park's **real product photos** (already scraped, see `apple_park_dolls.md`). Higher on "real products / on-brand" rubric than generated art.
- **Real doll names only** (Wren, Paloma, Luke, Gwen, Levi, Alex, Grady, Mia, Chloe) — not the placeholder "Savelie."

## Security (do first)
- The Inference.net key is committed in `plan.md` line 5 — **rotate it** and move to `.env.local` (`INFERENCE_API_KEY=...`). Add `.env*` to `.gitignore`. Never ship the key in client code — all LLM calls go through Next.js API routes (server-side).

## Tech stack
- **Next.js (App Router) + React + TypeScript + Tailwind CSS**
- **Vercel AI SDK**: `ai` + `@ai-sdk/openai-compatible`, pointed at Inference.net:
  ```ts
  // lib/llm.ts
  import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
  export const inference = createOpenAICompatible({
    name: 'inference',
    baseURL: 'https://api.inference.net/v1',
    apiKey: process.env.INFERENCE_API_KEY,
  });
  export const MODEL = 'google/gemma-3-27b-instruct/bf-16'; // swap for stronger hosted model if available
  ```
- `zod` for structured recommendation output; `react-qr-code` (or a static QR image) for the mock unlock.

## Data model — `data/dolls.json` (source data already exists!)
**`apple_park_dolls.md` in this repo is a complete, real scrape** (names, prices, SKUs, CDN image URLs, and — key — a distinct **personality line per character**). This IS the knowledge base; just transform it to JSON. Do NOT re-scrape.

Use the **8 "Park Friends" characters** (each has a ready-made personality, perfect for matching): Wren (cuddles/tea parties/story time), Paloma (kind, sharing & turn-taking), Gwen (music, sings), Mia (playful, loves surprises), Levi (builds sandcastles), Luke (helpful playground friend), Alex (curious, outdoorsy), Grady (caring, cheers others up), + Chloe (nurturing, bedtime). **Filter to Available only** for the demo path — Ella is sold out.

Each object:
```jsonc
{
  "id": "wren",
  "name": "Wren",
  "price": 55,                   // all Park Friends are $55; free shipping at $75 → optional outfit upsell
  "image": "/dolls/wren.jpg",    // download the clean product shot from the CDN URL in the .md to /public/dolls (hot-linking Shopify CDN works too as a fallback)
  "personality": ["cuddly","imaginative","loves-story-time"],
  "matchKeywords": ["shy","gentle","bedtime","tea-parties","red-hair"],
  "staticStory": "Red-haired friend in a blue muslin dress who loves cuddles, tea parties and story time." // from the .md "Page-summary facts" + personality line
}
```
`staticStory` + `personality` are injected into the story prompt so each generated story is unique but faithful to the character.

**On the "book":** the scrape has no per-character book, so frame the **AI-generated personalized story as the child's book** — this directly delivers the brand's "each doll comes with its own book" promise, personalized. Strong pitch line.

## Build — screens & files
App Router under `app/`. Warm/organic theme (sage/oatmeal palette, rounded serif headings) to hit the "on-brand" rubric.

1. **`app/page.tsx` — Landing.** Faithful-but-simplified Apple Park landing: hero carousel of real product images + brand tagline ("Wrapped in Love, Woven with Purpose"). Prominent **"Find your toy"** CTA under the carousel → routes to `/find`. Do NOT DOM-clone the live site (brittle) — rebuild with real assets.

2. **`app/find/page.tsx` — Gift-finder chat.** A **bounded 4-question** conversation (avoids demo ramble): child's **name**, **age**, **occasion**, and **what the gift-giver values / the child's personality**. LLM phrases each question warmly via `POST /api/chat` (streamed). Capture answers in client state.

3. **Recommendation → 3 cards.** After Q4, call `POST /api/recommend` → one `generateObject` call returning **exactly 3 real dolls** with a one-line reason each (grounded in `dolls.json` + the answers). Render 3 warm cards with **real photos**. (Correction vs original plan: generate the full story only for the *chosen* doll, not all 3 — saves latency/cost.)

4. **`app/meet/[dollId]/page.tsx` — "Meet [Doll]".** On pick, fade to this page: centered real doll image + **streamed personalized story** (`POST /api/story`, child + doll as protagonists, seeded by `staticStory`). Below/over it, play the **cached video** `public/videos/{dollId}.mp4` that ends on a **cliffhanger**. Then: **"Bring [Doll] home for [Child] — $55"** (add-to-cart, can be a mock confirm; optionally suggest a matching outfit to clear the $75 free-shipping bar), a **QR code** (mock) linking to `/unlock/[dollId]`, and a **next-chapter teaser** card ("Meet a new friend to unlock the next chapter").

5. **`app/unlock/[dollId]/page.tsx` — Mock unlock.** Plays the "full/continued" pre-made clip. Sells the post-purchase loop for the pitch without building fulfillment.

### API routes (all server-side, key never exposed)
- `app/api/chat/route.ts` — streams the warm question phrasing.
- `app/api/recommend/route.ts` — `generateObject` (zod schema: `{ recommendations: [{dollId, reason}] }`, length 3), constrained to ids present in `dolls.json`.
- `app/api/story/route.ts` — `streamText`, personalized story for the chosen doll.

## Cut line (protect the demo)
- **Must-have by ~1:30 PM:** Landing → chat (4 Qs) → 3 real dolls → pick → Meet page with streamed story + real photo + one cached video. This alone is a complete, winning demo.
- **Stretch (only if core is solid):** QR→unlock page, next-chapter teaser card, TTS narration of the story (one extra API call, big emotional payoff in the video), entrance animations.

## Suggested parallelization (team)
- **A:** transform `apple_park_dolls.md` → `dolls.json` (+ download product photos to `/public/dolls`) + landing page.
- **B:** chat + recommend API + 3-card UI.
- **C:** Meet page + story streaming + video wiring + unlock mock.
- **D:** design system/polish + **kick off video pre-generation by ~noon** (30–120s/clip, may need retries) + record the 1-min demo + build the 3-min pitch.

## Verification (end-to-end)
1. `npm run dev`; confirm `.env.local` loads and no key appears in the browser Network tab / client bundle.
2. **Provider smoke test:** `curl https://api.inference.net/v1/chat/completions -H "Authorization: Bearer $INFERENCE_API_KEY" -d '{"model":"google/gemma-3-27b-instruct/bf-16","messages":[{"role":"user","content":"hi"}]}'` returns a completion.
3. Walk the full flow for the **demo persona** (fixed name, e.g. "Emma", age, occasion) → verify 3 real dolls returned, `generateObject` validates, the chosen doll's story streams and stars Emma + the doll, the cached `{dollId}.mp4` plays and ends on the cliffhanger.
4. Confirm the QR resolves to `/unlock/[dollId]` and the continued clip plays.
5. **Dry-run the 2-min demo path once end-to-end before recording**, on the exact persona you'll show, to guarantee zero live-gen waits.
