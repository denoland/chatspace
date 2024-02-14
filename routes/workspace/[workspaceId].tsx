import { FreshContext, Handlers } from "$fresh/server.ts";
import { ChatUI } from "../../islands/ChatUI.tsx";
import { kv } from "../../lib/kv.ts";
import { ChatHead, WorkspaceInfo } from "../../lib/workspace.ts";

export const handler: Handlers = {
  async GET(_req: Request, ctx: FreshContext) {
    const info = await kv.get<WorkspaceInfo>([
      "workspaces",
      ctx.params.workspaceId,
    ]);
    if (!info.value) return ctx.renderNotFound();

    const heads = await Array.fromAsync(
      kv.list<ChatHead>({ prefix: ["heads", ctx.params.workspaceId] }),
    );
    info.value.heads = heads.map((x) => {
      delete x.value.messages;
      return x.value;
    });

    return ctx.render({
      workspaceId: ctx.params.workspaceId,
      workspaceInfo: info.value,
    });
  },
};

export default function Workspace(
  { data }: {
    data: { workspaceId: string; workspaceInfo: WorkspaceInfo };
  },
) {
  return (
    <div>
      <ChatUI
        workspaceId={data.workspaceId}
        workspaceInfo={data.workspaceInfo}
      />
    </div>
  );
}
