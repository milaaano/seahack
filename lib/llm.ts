import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const inference = createOpenAICompatible({
  name: "inference",
  baseURL:
    process.env.INFERENCE_BASE_URL ?? "https://model.service-inference.ai/v1",
  apiKey: process.env.INFERENCE_API_KEY ?? "",
});

// Inference.ai's OpenAI-compatible endpoint. Set INFERENCE_MODEL to override
// if the dashboard-selected model changes.
export const MODEL = process.env.INFERENCE_MODEL ?? "deepseek-chat";

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
    } catch (error) {
      console.warn("LLM stream failed before first token:", error);
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
      } catch (error) {
        console.warn("LLM stream failed mid-response:", error);
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
