import { streamText } from "ai";
import { inference, MODEL, LLM_TIMEOUT_MS, streamTextWithFallback } from "@/lib/llm";
import { getDoll } from "@/lib/dolls";

export const runtime = "nodejs";
export const maxDuration = 60;

type Body = {
  dollId: string;
  childName?: string;
  age?: string;
  occasion?: string;
  personality?: string;
};

function fallbackStory(name: string, dollName: string, staticStory: string) {
  return (
    `Once upon a time, in the gentle green world of Apple Park, there lived a little friend named ${dollName}. ` +
    `${staticStory} ` +
    `But lately, ${dollName} had been waiting for something — or someone. Every morning, ${dollName} would look down the winding park path and wonder, "Is today the day I meet ${name}?"\n\n` +
    `Then, one golden afternoon, the leaves began to rustle. A letter arrived, sealed with a tiny apple stamp, and on the front, in careful letters, it said: "To ${dollName} — from ${name}." ` +
    `${dollName}'s heart went pitter-pat. The two of them were going to be best friends, ${dollName} could just feel it — the kind of friends who share secrets, adventures, and the coziest quiet moments.\n\n` +
    `${dollName} carefully opened the envelope... and inside was something nobody in Apple Park had ever seen before. Something that sparkled. Something that had ${name}'s name on it, too.\n\n` +
    `But that... is a story for when you meet.`
  );
}

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  const doll = getDoll(body.dollId);
  if (!doll) {
    return new Response("Unknown doll", { status: 404 });
  }
  const childName = body.childName?.trim() || "your little one";

  const makeStream = () => {
    const result = streamText({
      model: inference(MODEL),
      system:
        "You write short, magical bedtime stories for Apple Park, a maker of organic heirloom dolls. " +
        "Style: warm, gentle, a little whimsical — like a classic picture book. Simple words a young child understands when read aloud. " +
        "STRICT rules: 4 short paragraphs, under 220 words total. The story stars the doll and the child as new best friends about to meet. " +
        "Stay faithful to the doll's real look and personality as described. " +
        "End on a gentle cliffhanger sentence that makes the child want to know what happens next, followed by the exact final line: 'But that... is a story for when you meet.'",
      prompt:
        `The doll: ${doll.name}. ${doll.staticStory} Personality: ${doll.personality.join(", ")}.\n` +
        `The child: ${childName}` +
        (body.age ? `, age ${body.age}` : "") +
        (body.occasion ? `. Occasion: ${body.occasion}` : "") +
        (body.personality ? `. ${childName} loves: ${body.personality}` : "") +
        `.\n\nWrite chapter one of the story of ${doll.name} and ${childName}.`,
      maxOutputTokens: 400,
      temperature: 0.8,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    return result.textStream;
  };

  return streamTextWithFallback(
    makeStream,
    fallbackStory(childName, doll.name, doll.staticStory)
  );
}
