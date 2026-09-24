import { hostEnv } from "../db/env";

/**
 * Cloudflare Workers AI over the REST API — no SDK. The API token stays
 * here; nothing about the account reaches the browser.
 *
 * Text models are called through /ai/run/<model> with a chat `messages`
 * array. JSON mode (`response_format.json_schema`) makes the model answer
 * with an object that follows the schema; Cloudflare documents it as best
 * effort, so callers still validate what comes back.
 */
const API = "https://api.cloudflare.com/client/v4";

/** Llama 3.3 70B supports JSON mode and writes usable Thai. */
export const DEFAULT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

/** One reading takes a few seconds on a 70B model; leave room but do not hang a request forever. */
const TIMEOUT_MS = 40_000;

function accountId(): string {
  return hostEnv("CLOUDFLARE_ACCOUNT_ID")?.trim() ?? "";
}
function apiToken(): string {
  return hostEnv("CLOUDFLARE_API_TOKEN")?.trim() ?? "";
}
export function aiModel(): string {
  return hostEnv("CLOUDFLARE_AI_MODEL")?.trim() || DEFAULT_MODEL;
}
export function cloudflareAiConfigured(): boolean {
  return Boolean(accountId() && apiToken());
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type RunResponse<T> = {
  success: boolean;
  result?: { response?: T | string };
  errors?: { code: number; message: string }[];
};

export class CloudflareAiError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "CloudflareAiError";
  }
}

/**
 * Run a chat completion in JSON mode and return the parsed object. Throws
 * CloudflareAiError on transport/API failure and a plain Error when the
 * model's answer is not JSON — both are the caller's cue to fall back.
 */
export async function runJson<T>(
  messages: ChatMessage[],
  schema: Record<string, unknown>,
  options: { model?: string; maxTokens?: number; temperature?: number } = {}
): Promise<T> {
  if (!cloudflareAiConfigured()) throw new CloudflareAiError(0, "Cloudflare AI not configured");
  const model = options.model ?? aiModel();
  const res = await fetch(`${API}/accounts/${encodeURIComponent(accountId())}/ai/run/${model}`, {
    method: "POST",
    headers: { authorization: `Bearer ${apiToken()}`, "content-type": "application/json" },
    body: JSON.stringify({
      messages,
      max_tokens: options.maxTokens ?? 1500,
      temperature: options.temperature ?? 0.7,
      response_format: { type: "json_schema", json_schema: schema },
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  const payload = (await res.json().catch(() => null)) as RunResponse<T> | null;
  if (!res.ok || !payload?.success) {
    const message = payload?.errors?.map((e) => `${e.code}: ${e.message}`).join("; ") || `HTTP ${res.status}`;
    throw new CloudflareAiError(res.status, message);
  }
  const raw = payload.result?.response;
  if (raw === undefined || raw === null) throw new Error("empty model response");
  if (typeof raw === "string") {
    // Some models answer with the JSON as text, occasionally fenced.
    const text = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    return JSON.parse(text) as T;
  }
  return raw;
}
