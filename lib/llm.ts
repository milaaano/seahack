import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const inference = createOpenAICompatible({
  name: "inference",
  baseURL: "https://api.inference.net/v1",
  apiKey: process.env.INFERENCE_API_KEY ?? "",
});

// Fast hosted instruct model on Inference.net (verified via /v1/models) —
// plenty for warm questions, a 3-pick match, and a 220-word story. Set
// INFERENCE_MODEL to override (e.g. meta-llama/llama-3.3-70b-instruct/fp-8
// for max quality at ~3-4x the latency).
export const MODEL =
  process.env.INFERENCE_MODEL ?? "meta-llama/llama-3.1-8b-instruct/fp-16";

// Bound every provider call so a slow/hung request can never stall the demo.
export const LLM_TIMEOUT_MS = 10_000;

// After a hard provider failure (bad key, outage), skip the provider entirely
// for a while — otherwise every question pays a pointless ~2s failed round-trip
// before its fallback.
let providerDeadUntil = 0;
export function providerLooksDead() {
  return Date.now() < providerDeadUntil;
}
export function markProviderDead() {
  providerDeadUntil = Date.now() + 120_000;
}

/**
 * Stream LLM text with a graceful fallback: if the provider errors before the
 * first token (bad key, network, rate limit), stream `fallbackText` instead so
 * the demo never stalls. Returns a plain text/plain streaming Response.
 */
export async function streamTextWithFallback(
  makeStream: () => AsyncIterable<string>,
  fallbackText: string
): Promise<Response> {
  const encoder = new TextEncoder();

  let iterator: AsyncIterator<string> | null = null;
  let first: IteratorResult<string> | null = null;
  if (!providerLooksDead()) {
    try {
      iterator = makeStream()[Symbol.asyncIterator]();
      first = await iterator.next();
    } catch {
      iterator = null;
    }
  }
  // On provider errors (e.g. 401) the SDK ends the text stream empty rather
  // than throwing, so an empty first read also means "use the fallback".
  const useReal = iterator !== null && first !== null && !first.done;
  if (!useReal && !providerLooksDead()) markProviderDead();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (useReal) {
          controller.enqueue(encoder.encode(first!.value));
          while (true) {
            const { value, done } = await iterator!.next();
            if (done) break;
            controller.enqueue(encoder.encode(value));
          }
        } else {
          // Fallback: stream the canned text word-by-word for a natural feel.
          for (const word of fallbackText.split(/(?<=\s)/)) {
            controller.enqueue(encoder.encode(word));
            await new Promise((r) => setTimeout(r, 8));
          }
        }
      } catch {
        // Provider died mid-stream — finish gracefully with whatever we have.
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
