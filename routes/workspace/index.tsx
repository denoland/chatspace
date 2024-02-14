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
    <div class="px-4 py-4">
      <form method="POST">
        <button
          class={`flex flex-row bg-gray-200 rounded-lg shadow text-black py-2 px-4 gap-2`}
          type="submit"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            data-slot="icon"
            class="w-6 h-6"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M12 4.5v15m7.5-7.5h-15"
            />
          </svg>
          <span>New workspace</span>
        </button>
      </form>
    </div>
  );
}
