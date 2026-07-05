import { generateObject } from "ai";
import { z } from "zod";
import {
  inference,
  MODEL,
  LLM_TIMEOUT_MS,
  markProviderDead,
  providerLooksDead,
} from "@/lib/llm";
import { dolls, dollIds } from "@/lib/dolls";

export const runtime = "nodejs";
export const maxDuration = 45;

const schema = z.object({
  recommendations: z
    .array(
      z.object({
        dollId: z.enum(dollIds as [string, ...string[]]),
        reason: z
          .string()
          .describe(
            "One warm sentence, addressed to the gift-giver, on why this doll fits this child"
          ),
      })
    )
    .length(3),
});

type Answers = {
  childName?: string;
  age?: string;
  occasion?: string;
  personality?: string;
};

/** Keyword-overlap heuristic used if the LLM is unavailable. */
function heuristicRecommend(a: Answers) {
  const text = `${a.personality ?? ""} ${a.occasion ?? ""}`.toLowerCase();
  const scored = dolls.map((d) => {
    let score = 0;
    for (const kw of [...d.matchKeywords, ...d.personality]) {
      if (text.includes(kw.replace(/-/g, " ")) || text.includes(kw)) score += 2;
    }
    return { doll: d, score };
  });
  scored.sort((x, y) => y.score - x.score);
  const top = scored.slice(0, 3);
  return {
    recommendations: top.map(({ doll }) => ({
      dollId: doll.id,
      reason: `${doll.name} is ${doll.personality
        .map((p) => p.replace(/-/g, " "))
        .slice(0, 2)
        .join(" and ")} — a friend who feels made for ${
        a.childName || "your little one"
      }.`,
    })),
  };
}

export async function POST(req: Request) {
  const answers = (await req.json()) as Answers;

  const catalog = dolls
    .map(
      (d) =>
        `- id: ${d.id} | name: ${d.name} | personality: ${d.personality.join(
          ", "
        )} | good match for: ${d.matchKeywords.join(", ")} | about: ${d.staticStory}`
    )
    .join("\n");

  try {
    if (providerLooksDead()) return Response.json(heuristicRecommend(answers));
    const { object } = await generateObject({
      model: inference(MODEL),
      schema,
      system:
        "You match children with handmade organic dolls from Apple Park's real catalog. " +
        "You must pick exactly 3 different dolls, only from the provided catalog ids. " +
        "Reasons are one warm sentence each, grounded in what the gift-giver shared, never generic.",
      prompt:
        `The child:\n- name: ${answers.childName}\n- age: ${answers.age}\n- occasion: ${answers.occasion}\n- loves / personality: ${answers.personality}\n\n` +
        `Catalog:\n${catalog}\n\nPick the 3 best-matching dolls for ${answers.childName}.`,
      temperature: 0.5,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    });
    // Defensive: dedupe; if the model repeated a doll, top up from the heuristic.
    const seen = new Set<string>();
    const recs = object.recommendations.filter((r) => {
      if (seen.has(r.dollId)) return false;
      seen.add(r.dollId);
      return true;
    });
    if (recs.length < 3) {
      for (const r of heuristicRecommend(answers).recommendations) {
        if (recs.length >= 3) break;
        if (!seen.has(r.dollId)) {
          seen.add(r.dollId);
          recs.push(r);
        }
      }
    }
    return Response.json({ recommendations: recs });
  } catch {
    markProviderDead();
    return Response.json(heuristicRecommend(answers));
  }
}
