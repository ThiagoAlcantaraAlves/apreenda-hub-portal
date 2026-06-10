// Shared MiniMax client (OpenAI-compatible Chat Completions API)
// Docs: https://platform.minimax.io/docs

export const MINIMAX_URL = "https://api.minimax.io/v1/text/chatcompletion_v2";
export const MINIMAX_MODEL = "MiniMax-M3";
export const MINIMAX_FALLBACK_MODEL = "MiniMax-M2.7-highspeed";

export type MiniMaxMessage = { role: "system" | "user" | "assistant" | "tool"; content: string };

export type CallMiniMaxOptions = {
  messages: MiniMaxMessage[];
  jsonMode?: boolean;
  temperature?: number;
  maxTokens?: number;
  model?: string;
  /** Model to retry with on transient upstream failures (429/5xx/network). Set to null/"" to disable. */
  fallbackModel?: string | null;
};

export type MiniMaxResult = { content: string; model: string };
export type MiniMaxStreamResult = { response: Response; model: string };

export class MiniMaxError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function getKey(): string {
  const key = Deno.env.get("MINIMAX_API_KEY");
  if (!key) throw new MiniMaxError(500, "minimax_not_configured", "MINIMAX_API_KEY not set");
  return key;
}

function isTransient(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

function buildBody(opts: CallMiniMaxOptions, model: string, stream: boolean): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 8192,
  };
  if (stream) body.stream = true;
  if (opts.jsonMode) body.response_format = { type: "json_object" };
  return body;
}

async function postOnce(key: string, body: Record<string, unknown>): Promise<Response> {
  return await fetch(MINIMAX_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(body),
  });
}

function mapError(status: number, txt: string): MiniMaxError {
  if (status === 429) return new MiniMaxError(429, "rate_limited", "MiniMax rate limited");
  if (status === 401 || status === 403) return new MiniMaxError(status, "minimax_auth_failed", "MiniMax auth failed");
  if (status === 402) return new MiniMaxError(402, "ai_credits_exhausted", "MiniMax balance exhausted");
  return new MiniMaxError(status, "minimax_upstream_error", `MiniMax ${status}: ${txt.slice(0, 200)}`);
}

/** Non-streaming call with optional fallback. Returns content + model actually used. */
export async function callMiniMax(opts: CallMiniMaxOptions): Promise<MiniMaxResult> {
  const key = getKey();
  const primary = opts.model || MINIMAX_MODEL;
  const fallback = opts.fallbackModel === null ? null : (opts.fallbackModel ?? MINIMAX_FALLBACK_MODEL);

  const attempts: string[] = [primary];
  if (fallback && fallback !== primary) attempts.push(fallback);

  let lastErr: MiniMaxError | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    try {
      const resp = await postOnce(key, buildBody(opts, model, false));
      if (resp.ok) {
        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content;
        const str = typeof content === "object" ? JSON.stringify(content) : String(content || "").trim();
        console.log("minimax_model_used", model);
        return { content: str, model };
      }
      const txt = await resp.text().catch(() => "");
      const err = mapError(resp.status, txt);
      console.error("minimax error", model, resp.status, txt.slice(0, 300));
      // Non-transient -> throw immediately (no fallback)
      if (!isTransient(resp.status)) throw err;
      lastErr = err;
    } catch (e) {
      if (e instanceof MiniMaxError && !isTransient(e.status)) throw e;
      // Network/timeout -> try fallback
      lastErr = e instanceof MiniMaxError ? e : new MiniMaxError(0, "minimax_network_error", String(e));
      console.error("minimax network/transient error", model, lastErr.message);
    }
  }
  throw lastErr ?? new MiniMaxError(500, "minimax_unknown", "unknown error");
}

/** JSON-mode call. Returns parsed object + model used. */
export async function callMiniMaxJSON<T = unknown>(opts: CallMiniMaxOptions): Promise<{ data: T; model: string }> {
  const { content, model } = await callMiniMax({ ...opts, jsonMode: true });
  const cleaned = content.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
  return { data: JSON.parse(cleaned) as T, model };
}

/** Streaming call with fallback. Returns the upstream SSE Response + the model used. */
export async function streamMiniMax(opts: CallMiniMaxOptions): Promise<MiniMaxStreamResult> {
  const key = getKey();
  const primary = opts.model || MINIMAX_MODEL;
  const fallback = opts.fallbackModel === null ? null : (opts.fallbackModel ?? MINIMAX_FALLBACK_MODEL);

  const attempts: string[] = [primary];
  if (fallback && fallback !== primary) attempts.push(fallback);

  let lastResp: Response | null = null;
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i];
    try {
      const resp = await postOnce(key, buildBody(opts, model, true));
      if (resp.ok && resp.body) {
        console.log("minimax_stream_model_used", model);
        return { response: resp, model };
      }
      const txt = await resp.text().catch(() => "");
      console.error("minimax stream error", model, resp.status, txt.slice(0, 300));
      if (!isTransient(resp.status)) {
        // Return non-transient error response immediately
        return { response: new Response(txt, { status: resp.status }), model };
      }
      lastResp = new Response(txt, { status: resp.status });
    } catch (e) {
      console.error("minimax stream network error", model, e);
      lastResp = new Response(String(e), { status: 502 });
    }
  }
  return { response: lastResp ?? new Response("upstream_failed", { status: 502 }), model: attempts[attempts.length - 1] };
}
