import OpenAI from "https://deno.land/x/openai@v4.28.0/mod.ts";
import { batchLoadMessages, ChatHead } from "./workspace.ts";
import {
  ChatCompletionChunk,
  ChatCompletionMessageParam,
} from "https://deno.land/x/openai@v4.28.0/resources/mod.ts";
import { Stream } from "https://deno.land/x/openai@v4.28.0/streaming.ts";

interface Backend {
  oai: OpenAI;
  model: string;
}

const backends: Map<string, Backend> = new Map();
const defaultBackendName = Deno.env.get("CHATSPACE_DEFAULT_BACKEND");

for (const [envName, envValue] of Object.entries(Deno.env.toObject())) {
  const prefix = "CHATSPACE_BACKEND_";

  if (!envName.startsWith(prefix)) continue;
  const backendName = envName.slice(prefix.length).toLowerCase();
  const [backendUrl, backendKey, model] = envValue.split(",");
  if (!backendUrl || !backendKey || !model) {
    console.warn(`Invalid backend "${backendName}"`);
  }

  const oai = new OpenAI({
    baseURL: backendUrl,
    apiKey: backendKey,
  });
  backends.set(backendName, {
    oai,
    model,
  });
}

export async function generateChatCompletions(
  kv: Deno.Kv,
  workspaceId: string,
  head: ChatHead,
): Promise<
  { stream: Stream<ChatCompletionChunk>; backendName: string } | null
> {
  const messages: ChatCompletionMessageParam[] = [];

  messages.push({ role: "system", content: head.systemPrompt });

  const messageIds = head.messages ?? [];
  const boundary = messageIds.findLastIndex((x) => x === "") + 1;
  for (
    const msg of await batchLoadMessages(
      kv,
      workspaceId,
      messageIds.slice(boundary),
    )
  ) {
    if (msg.role === "user") {
      messages.push({ role: "user", content: msg.text });
    } else if (msg.role === "assistant") {
      messages.push({ role: "assistant", content: msg.text });
    } else {
      // ignore
    }
  }

  const backendName = head.backend ?? defaultBackendName;
  if (!backendName) return null;
  const backend = backends.get(backendName);
  if (!backend) return null;

  const stream = await backend.oai.chat.completions.create({
    model: backend.model,
    messages,
    stream: true,
  });
  return { stream, backendName };
}

export function getAllBackendNames(): string[] {
  const res = Array.from(backends.keys());

  // promote default backend to start of array
  if (defaultBackendName) {
    const idx = res.indexOf(defaultBackendName);
    if (idx !== -1) {
      res.splice(idx, 1);
      res.unshift(defaultBackendName);
    }
  }

  return res;
}

export function isValidBackendName(name: string): boolean {
  return backends.has(name);
}
