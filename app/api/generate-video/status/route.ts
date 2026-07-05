import { writeFile } from "node:fs/promises";
import path from "node:path";
import { getDoll } from "@/lib/dolls";

export const runtime = "nodejs";

type VideoTask = {
  id: string;
  status: string;
  outputs?: string[];
  error?: unknown;
};

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
    return Response.json(
      {
        error: `Inference.ai request failed: ${message}`,
        providerStatus: error.status,
        providerPath: error.pathPart,
        providerMessage: message,
      },
      { status: error.status === 403 ? 403 : 502 }
    );
  }

  return Response.json(
    { error: error instanceof Error ? error.message : "Video status check failed" },
    { status: 502 }
  );
}

async function inferenceFetch<T>(pathPart: string, apiKey: string, base: string) {
  const res = await fetch(joinUrl(base, pathPart), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
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

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const taskId = searchParams.get("taskId");
  const dollId = searchParams.get("dollId");

  if (!taskId) {
    return Response.json({ error: "Missing taskId" }, { status: 400 });
  }

  const apiKey = process.env.INFERENCE_API_KEY;
  const base =
    process.env.INFERENCE_BASE_URL ?? "https://model.service-inference.ai/v1";
  if (!apiKey) {
    return Response.json(
      { error: "Set INFERENCE_API_KEY to an sk-inf-v1 inference key." },
      { status: 501 }
    );
  }

  try {
    const { task } = await inferenceFetch<{ task: VideoTask }>(
      `/video/tasks/${taskId}`,
      apiKey,
      base
    );

    if (task.status === "failed") {
      return Response.json(
        {
          task,
          error:
            typeof task.error === "string" ? task.error : "Video generation failed",
        },
        { status: 502 }
      );
    }

    if (task.status !== "completed" || !task.outputs?.[0] || !dollId) {
      return Response.json({ task });
    }

    const doll = getDoll(dollId);
    if (!doll) return Response.json({ task });

    const video = await fetch(task.outputs[0]);
    if (!video.ok) {
      return Response.json(
        { task, error: "Completed, but download failed" },
        { status: 502 }
      );
    }

    const file = path.join(process.cwd(), "public/videos", `${doll.id}-live.mp4`);
    await writeFile(file, Buffer.from(await video.arrayBuffer()));

    return Response.json({
      task,
      url: `/videos/${doll.id}-live.mp4`,
      providerUrl: task.outputs[0],
    });
  } catch (error) {
    return providerErrorResponse(error);
  }
}
