import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getDoll } from "@/lib/dolls";

export const runtime = "nodejs";
export const maxDuration = 300;

type GenerateBody = {
  dollId: string;
  story?: string;
  childName?: string;
  imageUrl?: string;
  wait?: boolean;
};

type VideoTask = {
  id: string;
  status: "pending" | "processing" | "completed" | "failed" | string;
  outputs?: string[];
  error?: unknown;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const defaultVideoModel = "dreamina-seedance-2-0-260128";

class InferenceError extends Error {
  constructor(
    readonly pathPart: string,
    readonly status: number,
    readonly body: string
  ) {
    super(`${pathPart} failed: ${status} ${body}`);
  }
}

function joinUrl(base: string, pathPart: string) {
  return `${base.replace(/\/$/, "")}/${pathPart.replace(/^\//, "")}`;
}

function configuredVideoModel() {
  return process.env.INFERENCE_VIDEO_MODEL ?? defaultVideoModel;
}

function recordValue(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function providerMessage(body: string) {
  try {
    const root = recordValue(JSON.parse(body) as unknown);
    const error = recordValue(root?.error);
    const message = error?.message;
    if (typeof message === "string") return message;
  } catch {}

  return body;
}

function providerErrorResponse(error: unknown) {
  if (error instanceof InferenceError) {
    const message = providerMessage(error.body);
    const modelUnavailable =
      error.status === 403 && /model .*not available/i.test(message);

    return Response.json(
      {
        error: modelUnavailable
          ? `The configured video model is not enabled for this Inference.ai account: ${configuredVideoModel()}. Ask Inference.ai to enable it, or set INFERENCE_VIDEO_MODEL to a model your account can use.`
          : `Inference.ai request failed: ${message}`,
        providerStatus: error.status,
        providerPath: error.pathPart,
        providerMessage: message,
      },
      { status: error.status === 403 ? 403 : 502 }
    );
  }

  return Response.json(
    {
      error: error instanceof Error ? error.message : "Video generation failed",
    },
    { status: 502 }
  );
}

function publicDollImageUrl(dollImage: string, override?: string) {
  if (override?.startsWith("http")) return override;

  const origin =
    process.env.NEXT_PUBLIC_SITE_URL ??
    process.env.VERCEL_URL?.replace(/^/, "https://") ??
    process.env.PUBLIC_APP_URL;

  if (!origin) return null;
  return joinUrl(origin, dollImage);
}

async function inferenceFetch<T>(
  pathPart: string,
  init: RequestInit,
  apiKey: string,
  base: string
): Promise<T> {
  const res = await fetch(joinUrl(base, pathPart), {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const text = await res.text();

  if (!res.ok) {
    throw new InferenceError(pathPart, res.status, text);
  }

  if (!text) return {} as T;

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new InferenceError(pathPart, 502, `Invalid JSON response: ${text}`);
  }
}

async function createAssetGroup(apiKey: string, base: string, dollName: string) {
  const body = {
    name: `apple-park-${dollName.toLowerCase()}-${Date.now()}`,
    description: `Reference assets for ${dollName} story video`,
  };
  const group = await inferenceFetch<{ id: string }>(
    "/asset-groups",
    { method: "POST", body: JSON.stringify(body) },
    apiKey,
    base
  );
  return group.id;
}

function missingAssetGroup(error: unknown) {
  return (
    error instanceof InferenceError &&
    (error.status === 404 ||
      /group.*(not found|not exist|missing)/i.test(providerMessage(error.body)))
  );
}

async function getAssetGroupId(apiKey: string, base: string, dollName: string) {
  const configuredGroupId = process.env.INFERENCE_ASSET_GROUP_ID?.trim();
  if (!configuredGroupId) return createAssetGroup(apiKey, base, dollName);

  try {
    await inferenceFetch<{ id: string }>(
      `/asset-groups/${configuredGroupId}`,
      { method: "GET" },
      apiKey,
      base
    );
    return configuredGroupId;
  } catch (error) {
    if (missingAssetGroup(error)) return createAssetGroup(apiKey, base, dollName);
    throw error;
  }
}

async function uploadImageAsset(
  apiKey: string,
  base: string,
  groupId: string,
  imageUrl: string,
  dollName: string
) {
  const asset = await inferenceFetch<{ id: string; task_id: string; status: string }>(
    "/assets",
    {
      method: "POST",
      body: JSON.stringify({
        group_id: groupId,
        url: imageUrl,
        asset_type: "Image",
        name: dollName,
      }),
    },
    apiKey,
    base
  );

  const deadline = Date.now() + 60_000;
  while (Date.now() < deadline) {
    const current = await inferenceFetch<{ id: string; status: string; error?: unknown }>(
      "/assets/get",
      {
        method: "POST",
        body: JSON.stringify({ asset_id: asset.id, task_id: asset.task_id }),
      },
      apiKey,
      base
    );
    if (current.status === "completed") return current.id;
    if (current.status === "failed") {
      throw new Error(`Image asset failed: ${JSON.stringify(current.error)}`);
    }
    await sleep(2500);
  }

  throw new Error("Timed out waiting for image asset");
}

async function uploadReferenceImage(
  apiKey: string,
  base: string,
  imageUrl: string,
  dollName: string
) {
  const configuredGroupId = process.env.INFERENCE_ASSET_GROUP_ID?.trim();
  const groupId = await getAssetGroupId(apiKey, base, dollName);

  try {
    return await uploadImageAsset(apiKey, base, groupId, imageUrl, dollName);
  } catch (error) {
    if (configuredGroupId && missingAssetGroup(error)) {
      const freshGroupId = await createAssetGroup(apiKey, base, dollName);
      return uploadImageAsset(apiKey, base, freshGroupId, imageUrl, dollName);
    }

    throw error;
  }
}

function videoPrompt({
  dollName,
  childName,
  story,
  staticStory,
}: {
  dollName: string;
  childName: string;
  story?: string;
  staticStory: string;
}) {
  const storySource =
    story?.trim() ||
    `${dollName} is waiting in Apple Park to meet ${childName}. ${staticStory}`;

  return [
    "Create a gentle, premium storybook video for Apple Park Kids.",
    `The child is ${childName}. The doll is ${dollName}.`,
    `Story basis: ${storySource}`,
    "Visual style: soft handmade organic cotton doll, cozy picture-book world, warm afternoon park light, subtle camera movement, tender and magical, no scary imagery.",
    "Scene arc: the doll notices a tiny sparkle near the path, reaches toward it, and the scene ends on a sweet cliffhanger before the surprise is revealed.",
  ].join("\n");
}

export async function POST(req: Request) {
  let body: GenerateBody;
  try {
    body = (await req.json()) as GenerateBody;
  } catch {
    return Response.json({ error: "Invalid JSON request body" }, { status: 400 });
  }

  if (typeof body.dollId !== "string") {
    return Response.json({ error: "Missing dollId" }, { status: 400 });
  }

  const doll = getDoll(body.dollId);
  if (!doll) return Response.json({ error: "Unknown doll" }, { status: 404 });

  const apiKey = process.env.INFERENCE_API_KEY;
  const base =
    process.env.INFERENCE_BASE_URL ?? "https://model.service-inference.ai/v1";
  if (!apiKey) {
    return Response.json(
      {
        error:
          "Live generation not configured. Set INFERENCE_API_KEY to an sk-inf-v1 inference key.",
      },
      { status: 501 }
    );
  }

  const childName = body.childName?.trim() || "your little one";
  const prompt = videoPrompt({
    dollName: doll.name,
    childName,
    story: body.story,
    staticStory: doll.staticStory,
  });

  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
  ];

  const imageUrl = publicDollImageUrl(doll.image, body.imageUrl);

  try {
    if (imageUrl) {
      const assetId = await uploadReferenceImage(
        apiKey,
        base,
        imageUrl,
        doll.name
      );
      content.push({
        type: "image_url",
        image_url: { url: `asset://${assetId}` },
        role: "reference_image",
      });
    }

    const submit = await inferenceFetch<{ task: VideoTask }>(
      "/video/generate",
      {
        method: "POST",
        body: JSON.stringify({
          model: configuredVideoModel(),
          content,
          duration: Number(process.env.INFERENCE_VIDEO_DURATION ?? 4),
          resolution: process.env.INFERENCE_VIDEO_RESOLUTION ?? "480p",
          ratio: process.env.INFERENCE_VIDEO_RATIO ?? "16:9",
          generate_audio: process.env.INFERENCE_VIDEO_AUDIO === "true",
          watermark: false,
          return_last_frame: true,
        }),
      },
      apiKey,
      base
    );

    if (body.wait === false) {
      return Response.json({
        ok: true,
        taskId: submit.task.id,
        status: submit.task.status,
        usedReferenceImage: Boolean(imageUrl),
      });
    }

    const deadline = Date.now() + 240_000;
    while (Date.now() < deadline) {
      await sleep(5000);
      const poll = await inferenceFetch<{ task: VideoTask }>(
        `/video/tasks/${submit.task.id}`,
        { method: "GET" },
        apiKey,
        base
      );

      if (poll.task.status === "completed" && poll.task.outputs?.[0]) {
        const video = await fetch(poll.task.outputs[0]);
        if (!video.ok) {
          return Response.json(
            { error: `Video download failed: ${video.status}` },
            { status: 502 }
          );
        }
        const file = path.join(process.cwd(), "public/videos", `${doll.id}-live.mp4`);
        await writeFile(file, Buffer.from(await video.arrayBuffer()));
        return Response.json({
          ok: true,
          taskId: poll.task.id,
          url: `/videos/${doll.id}-live.mp4`,
          providerUrl: poll.task.outputs[0],
          usedReferenceImage: Boolean(imageUrl),
        });
      }

      if (poll.task.status === "failed") {
        return Response.json(
          {
            error:
              typeof poll.task.error === "string"
                ? poll.task.error
                : "Generation failed",
            details: poll.task.error,
          },
          { status: 502 }
        );
      }
    }

    return Response.json(
      {
        ok: false,
        taskId: submit.task.id,
        status: "pending",
        message:
          "Video generation is still running. Poll /api/generate-video/status?taskId=... or the provider task endpoint.",
        usedReferenceImage: Boolean(imageUrl),
      },
      { status: 202 }
    );
  } catch (error) {
    return providerErrorResponse(error);
  }
}
