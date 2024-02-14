import { FreshContext, Handlers } from "$fresh/server.ts";
import { kv } from "../../../../../lib/kv.ts";
import { safelyRenderMarkdown } from "../../../../../lib/markdown.ts";
import { ChatMessage } from "../../../../../lib/workspace.ts";

export const handler: Handlers = {
  async GET(req: Request, ctx: FreshContext) {
    const key = [
      "messages",
      ctx.params.workspaceId,
      ctx.params.messageId,
    ];
    if (req.headers.get("accept") === "text/event-stream") {
      const encoder = new TextEncoder();
      const encoderStream = new TransformStream({
        transform: async (
          [message]: [Deno.KvEntryMaybe<ChatMessage>],
          controller,
        ) => {
          if (message.value) {
            message.value.html = await safelyRenderMarkdown(message.value.text);
          }
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(message.value)}\n\n`),
          );
        },
      });
      kv.watch([key]).pipeTo(encoderStream.writable).catch((e) => {
        if ("" + e === "resource closed") {
          return;
        }
        console.log(`Error watching ${key}: ${e}`);
      });
      return new Response(encoderStream.readable, {
        headers: {
          "content-type": "text/event-stream",
        },
      });
    }

    return Response.json((await kv.get<ChatMessage>(key)).value);
  },
};
