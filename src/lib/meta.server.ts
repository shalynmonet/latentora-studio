// Server-only client for Meta Model API (https://api.meta.ai/v1).
// Endpoints/models verified against dev.meta.ai docs and this account's /v1/models list.
const BASE = "https://api.meta.ai/v1";

export const META_MODELS = {
  spark: "muse-spark-1.3",
  image: "muse-image-1.0",
  sam: "sam-3.1",
  /** Meta's coding model on Model API (verified in this account's /v1/models list). */
  code: "muse-wonder-1.0",
} as const;

export const CHAT_ENDPOINT = `${BASE}/chat/completions`;

export class MetaUnavailableError extends Error {}

function key(): string {
  const k = process.env["MODEL_API_KEY"];
  if (!k) throw new MetaUnavailableError("MODEL_API_KEY is not configured");
  return k;
}

export function metaConfigured() {
  return Boolean(process.env["MODEL_API_KEY"]);
}

async function post(path: string, body: unknown, timeoutMs = 90_000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Meta API ${path} ${res.status}: ${text.slice(0, 500)}`);
      throw new MetaUnavailableError(`Meta API returned ${res.status}`);
    }
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof MetaUnavailableError) throw e;
    console.error(`Meta API ${path} failed`, e);
    throw new MetaUnavailableError("Meta API request failed");
  } finally {
    clearTimeout(timer);
  }
}

/** Muse Spark via Chat Completions with constrained JSON output. */
export async function sparkJSON<T>(opts: {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
  /** Optional native file (e.g. PDF) sent inline as a Chat Completions `file` content block. */
  file?: { filename: string; dataUrl: string };
  timeoutMs?: number;
}): Promise<T> {
  const userContent = opts.file
    ? [
        { type: "text", text: opts.user },
        { type: "file", file: { filename: opts.file.filename, file_data: opts.file.dataUrl } },
      ]
    : opts.user;
  const data = await post("/chat/completions", {
    model: META_MODELS.spark,
    reasoning_effort: "low",
    messages: [
      { role: "developer", content: opts.system },
      { role: "user", content: userContent },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: opts.schemaName, schema: opts.schema },
    },
  }, opts.timeoutMs);
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new MetaUnavailableError("Empty response from Muse Spark");
  return JSON.parse(content) as T;
}

/** Muse Wonder code generation via Chat Completions with constrained JSON output. */
export async function codeJSON<T>(opts: { system: string; user: string; schemaName: string; schema: Record<string, unknown> }): Promise<T> {
  const data = await post(
    "/chat/completions",
    {
      model: META_MODELS.code,
      reasoning_effort: "low",
      messages: [
        { role: "developer", content: opts.system },
        { role: "user", content: opts.user },
      ],
      response_format: { type: "json_schema", json_schema: { name: opts.schemaName, schema: opts.schema } },
    },
    280_000,
  );
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string") throw new MetaUnavailableError("Empty response from Muse Wonder");
  if (data?.choices?.[0]?.finish_reason === "length") throw new MetaUnavailableError("Muse Wonder ran out of room");
  return JSON.parse(content) as T;
}

/** Muse Image one-shot generation; returns base64 JPEG. */
export async function museImage(prompt: string): Promise<string> {
  const data = await post(
    "/images/generations",
    {
      model: META_MODELS.image,
      prompt,
      n: 1,
      size: "1536x1024",
      output_format: "jpeg",
      reasoning_strength: "low",
      tool_enablement: { enable_image_search: false, enable_web_search: false, enable_shell: false },
    },
    120_000,
  );
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") throw new MetaUnavailableError("Muse Image returned no image");
  return b64;
}

/** Muse Image edit/compose from a reference photo (JSON body with data URL); returns base64 JPEG. */
export async function museImageEdit(prompt: string, imageDataUrl: string): Promise<string> {
  const data = await post(
    "/images/edits",
    {
      model: META_MODELS.image,
      prompt,
      images: [{ image_url: imageDataUrl }],
      n: 1,
      size: "1536x1024",
      output_format: "jpeg",
      reasoning_strength: "low",
    },
    150_000,
  );
  const b64 = data?.data?.[0]?.b64_json;
  if (typeof b64 !== "string") throw new MetaUnavailableError("Muse Image returned no image");
  return b64;
}

/** SAM 3.1 concept segmentation via the Responses API. Returns raw output text. */
export async function samSegment(imageDataUrl: string, concept: string): Promise<string> {
  const data = await post("/responses", {
    model: META_MODELS.sam,
    input: [
      {
        type: "message",
        role: "user",
        content: [
          { type: "input_text", text: concept },
          { type: "input_image", image_url: imageDataUrl },
        ],
      },
    ],
    metadata: { include_confidence: "true" },
  });
  if (typeof data?.output_text === "string") return data.output_text;
  const parts: string[] = [];
  for (const item of data?.output ?? []) {
    for (const c of item?.content ?? []) if (typeof c?.text === "string") parts.push(c.text);
  }
  return parts.join("\n");
}
