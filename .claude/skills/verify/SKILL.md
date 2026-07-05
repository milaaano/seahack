---
name: verify
description: Build/launch/drive recipe for verifying the Apple Park "Meet [Doll]" Next.js app end-to-end.
---

# Verify: Apple Park gift-finder app

## Launch

```bash
npm run dev -- --port 3123   # ready in ~1.5s; port 3000 default
```

## Drive the demo flow (server surface)

```bash
# gift-finder questions (streamed text/plain)
curl -s localhost:3123/api/chat -H 'Content-Type: application/json' \
  -d '{"step":0,"answers":{}}'
# recommendations (JSON, exactly 3 dolls from data/dolls.json)
curl -s localhost:3123/api/recommend -H 'Content-Type: application/json' \
  -d '{"childName":"Emma","age":"5","occasion":"birthday","personality":"shy, loves tea parties"}'
# personalized story (streamed)
curl -s localhost:3123/api/story -H 'Content-Type: application/json' \
  -d '{"dollId":"wren","childName":"Emma"}'
# pages: / /find /meet/wren /unlock/wren ; assets: /videos/wren.mp4 /dolls/wren.png
```

## Screenshots (GUI surface)

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless \
  --window-size=1280,1600 --virtual-time-budget=9000 \
  --screenshot=/tmp/shot.png http://localhost:3123/meet/wren
```

## Gotchas

- The Inference.net key in `.env.local` is a management key → completions 401 and
  every route serves its **fallback** content. That is expected; live-LLM output is
  unverifiable until a real inference key is set.
- On provider errors AI SDK v7's `textStream` ends **empty** (no throw) — fallback
  logic keys off an empty first read (`lib/llm.ts`).
- Key-leak check: `grep -rl "$(grep INFERENCE_API_KEY .env.local | cut -d= -f2)" .next/static` must be empty.
- Regenerate cached clips: `node scripts/gen_videos.mjs` (uses sharp for text PNGs —
  this machine's ffmpeg lacks drawtext; overlay/xfade/zoompan are available).
