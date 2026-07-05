import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getDoll } from "@/lib/dolls";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Live Seedance 2.0 video generation (submit → poll → download), per
 * IMPLEMENTATION_PLAN.md kept OFF the demo critical path — the demo plays
 * pre-generated clips from /public/videos. This proves the pipeline works
 * live when SEEDANCE_API_KEY (HolyCrab or any Seedance provider with the
 * async-job shape below) is configured.
 *
 * Expected provider shape (HolyCrab-style):
 *   POST {BASE}/v1/videos/generations         -> { id }
 *   GET  {BASE}/v1/videos/generations/{id}    -> { status, video_url? }
 */
export async function POST(req: Request) {
  const { dollId } = (await req.json()) as { dollId: string };
  const doll = getDoll(dollId);
  if (!doll) return Response.json({ error: "Unknown doll" }, { status: 404 });

  const apiKey = process.env.SEEDANCE_API_KEY;
  const base = process.env.SEEDANCE_API_BASE;
  if (!apiKey || !base) {
    return Response.json(
      {
        error:
          "Live generation not configured. Set SEEDANCE_API_KEY and SEEDANCE_API_BASE " +
          "(HolyCrab or any Seedance 2.0 provider). The demo uses cached clips in /public/videos.",
      },
      { status: 501 }
    );
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  const prompt =
    `Gentle storybook animation of a soft handmade fabric doll: ${doll.staticStory} ` +
    `Warm afternoon light in a leafy park, cozy picture-book mood, slow camera push-in, ` +
    `ending on a suspenseful pause as the doll notices something sparkling off-screen.`;

  const submit = await fetch(`${base}/v1/videos/generations`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: "seedance-2.0",
      prompt,
      duration: 10,
      aspect_ratio: "1:1",
    }),
  });
  if (!submit.ok) {
    return Response.json(
      { error: `Submit failed: ${submit.status} ${await submit.text()}` },
      { status: 502 }
    );
  }
  const { id } = (await submit.json()) as { id: string };

  // Poll (30–120s typical per plan)
  const deadline = Date.now() + 240_000;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 5000));
    const poll = await fetch(`${base}/v1/videos/generations/${id}`, { headers });
    if (!poll.ok) continue;
    const job = (await poll.json()) as { status: string; video_url?: string };
    if (job.status === "completed" && job.video_url) {
      const video = await fetch(job.video_url);
      const file = path.join(process.cwd(), "public/videos", `${doll.id}-live.mp4`);
      await writeFile(file, Buffer.from(await video.arrayBuffer()));
      return Response.json({ ok: true, url: `/videos/${doll.id}-live.mp4` });
    }
    if (job.status === "failed") {
      return Response.json({ error: "Generation failed" }, { status: 502 });
    }
  }
  return Response.json({ error: "Timed out waiting for video" }, { status: 504 });
}
