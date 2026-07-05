import { generateText } from "ai";
import {
  inference,
  markProviderDead,
  MODEL,
  providerLooksDead,
} from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

type Answers = {
  childName?: string;
  age?: string;
  occasion?: string;
  personality?: string;
};

const QUESTION_GOALS = [
  "the child's first name",
  "the child's age",
  "the occasion for the gift (birthday, holiday, just-because...)",
  "what the child loves and what their personality is like",
];

const CHAT_TIMEOUT_MS = 5_000;

function fallbackQuestion(step: number, a: Answers): string {
  const name = a.childName?.trim() || "your little one";
  switch (step) {
    case 0:
      return "Hello! I'd love to help you find the perfect friend. Who is this gift for — what's their name?";
    case 1:
      return `What a lovely name! How old is ${name}?`;
    case 2:
      return `Wonderful. And what's the occasion — a birthday, a holiday, or just a little something special for ${name}?`;
    default:
      return `One last thing: tell me a bit about ${name}. What do they love to do, and what are they like?`;
  }
}

function streamLocalText(text: string) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      for (const word of text.split(/(?<=\s)/)) {
        controller.enqueue(encoder.encode(word));
        await new Promise((r) => setTimeout(r, 8));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(req: Request) {
  const { step = 0, answers = {} } = (await req.json()) as {
    step: number;
    answers: Answers;
  };

  const known = Object.entries(answers)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`)
    .join("; ");

  const fallback = fallbackQuestion(step, answers);

  if (providerLooksDead()) return streamLocalText(fallback);

  try {
    const { text } = await generateText({
      model: inference(MODEL),
      system:
        "You are the warm, gentle gift guide for Apple Park, a maker of organic heirloom dolls. " +
        "You speak to a gift-giver (a parent, grandparent, or friend) looking for a doll for a child. " +
        "Your tone is cozy and sincere, never salesy. Keep it to ONE short question (max 2 sentences). " +
        "No emojis except at most one subtle one. Never mention you are an AI.",
      prompt:
        `So far the gift-giver has shared: ${known || "nothing yet"}.\n` +
        `Warmly ask exactly one question to learn: ${QUESTION_GOALS[Math.min(step, 3)]}.` +
        (answers.childName ? ` Refer to the child by name (${answers.childName}).` : ""),
      maxOutputTokens: 90,
      temperature: 0.7,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });

    const question = text.trim();
    if (question.length < 24) throw new Error(`Question too short: ${question}`);
    return streamLocalText(question);
  } catch (error) {
    console.warn("Chat question LLM failed; using fallback:", error);
    markProviderDead();
    return streamLocalText(fallback);
  }
}
