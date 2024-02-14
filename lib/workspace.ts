import { Signal, signal } from "@preact/signals";
import { createContext } from "preact";

export interface WorkspaceState {
  id: string;
  heads: Signal<Map<string, ChatHead>>;
  currentHead: Signal<string>;
}

export interface WorkspaceInfo {
  heads: ChatHead[];
  createdAt: number;
}

export interface ChatHead {
  id: string;
  backend?: string;
  title: string;
  systemPrompt: string;
  timestamp: number;
  messages?: string[];
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  backend?: string;
  text: string;
  html?: string;
  timestamp: number;
  completed: boolean;
  interrupted?: boolean;
}

export const WorkspaceStateContext = createContext<WorkspaceState | null>(null);

export function createWorkspaceState(
  id: string,
  info: WorkspaceInfo,
): WorkspaceState {
  const state: WorkspaceState = {
    id,
    heads: signal(new Map(info.heads.map((head) => [head.id, head]))),
    currentHead: signal(""),
  };

  return state;
}

export async function batchLoadMessages(
  kv: Deno.Kv,
  workspaceId: string,
  messageIds: string[],
): Promise<ChatMessage[]> {
  messageIds = messageIds.filter((x) => x);

  const batchSize = 10;

  const messages: ChatMessage[] = [];
  for (let i = 0; i < messageIds.length; i += batchSize) {
    const batch = messageIds.slice(i, i + batchSize);
    const batchMessages = await kv.getMany<ChatMessage[]>(
      batch.map((x) => ["messages", workspaceId, x]),
    );
    messages.push(...batchMessages.map((m) => {
      if (m.value !== null) {
        return m.value;
      } else {
        throw new Error("Message not found");
      }
    }));
  }

  return messages;
}
