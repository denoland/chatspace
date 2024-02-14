import { FreshContext, Handlers } from "$fresh/server.ts";
import { ulid } from "https://deno.land/x/ulid@v0.3.0/mod.ts";
import { kv } from "../../../../lib/kv.ts";
import { ChatHead, WorkspaceInfo } from "../../../../lib/workspace.ts";

export const handler: Handlers = {
  async POST(_req: Request, ctx: FreshContext) {
    // create a new conversation
    const info = await kv.get<WorkspaceInfo>([
      "workspaces",
      ctx.params.workspaceId,
    ]);
    if (!info.value) return ctx.renderNotFound();

    const head: ChatHead = {
      id: ulid(),
      title: "New Chat",
      systemPrompt: "You are a helpful assistant.",
      timestamp: Date.now(),
    };
    await kv.set(["heads", ctx.params.workspaceId, head.id], head);

    return Response.json(head, { status: 201 });
  },
};
