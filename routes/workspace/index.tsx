import { useSignal } from "@preact/signals";
import { FreshContext, Handlers } from "$fresh/server.ts";
import { ChatUI } from "../../islands/ChatUI.tsx";
import { kv } from "../../lib/kv.ts";
import {
  createWorkspaceState,
  WorkspaceInfo,
  WorkspaceStateContext,
} from "../../lib/workspace.ts";
import { useMemo, useState } from "preact/hooks";
import { ulid } from "https://deno.land/x/ulid@v0.3.0/mod.ts";

export const handler: Handlers = {
  GET(_req: Request, ctx: FreshContext) {
    return ctx.render({});
  },

  async POST(req: Request, ctx: FreshContext) {
    const workspaceId = ulid();
    const info: WorkspaceInfo = {
      heads: [],
      createdAt: Date.now(),
    };
    await kv.set([
      "workspaces",
      workspaceId,
    ], info);

    return Response.redirect(
      new URL(req.url).origin + `/workspace/${workspaceId}`,
      302,
    );
  },
};

export default function WorkspaceInit() {
  return (
    <div>
      <form method="POST">
        <button type="submit">Create new workspace</button>
      </form>
    </div>
  );
}
