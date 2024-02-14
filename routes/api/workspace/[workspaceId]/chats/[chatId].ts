import { FreshContext, Handlers } from "$fresh/server.ts";
import { ulid } from "https://deno.land/x/ulid@v0.3.0/mod.ts";
import { kv } from "../../../../../lib/kv.ts";
import {
  batchLoadMessages,
  ChatHead,
  ChatMessage,
} from "../../../../../lib/workspace.ts";
import {
  generateChatCompletions,
  getAllBackendNames,
  isValidBackendName,
} from "../../../../../lib/oai.ts";
import { safelyRenderMarkdown } from "../../../../../lib/markdown.ts";

export const handler: Handlers = {
  async GET(req: Request, ctx: FreshContext) {
    const key = [
      "heads",
      ctx.params.workspaceId,
      ctx.params.chatId,
    ];
    const availableBackends = getAllBackendNames();

    if (req.headers.get("accept") === "text/event-stream") {
      const seenMessages: Set<string> = new Set();
      const encoder = new TextEncoder();
      const encoderStream = new TransformStream({
        transform: async (
          [head]: [Deno.KvEntryMaybe<ChatHead>],
          controller,
        ) => {
          const messages = await batchLoadMessages(
            kv,
            ctx.params.workspaceId,
            head.value?.messages?.filter((x) => !seenMessages.has(x)) ?? [],
          );
          for (const m of messages) {
            seenMessages.add(m.id);
            m.html = await safelyRenderMarkdown(m.text);
          }
          controller.enqueue(
            encoder.encode(`data: ${
              JSON.stringify({
                head: head.value,
                messages,
                availableBackends,
              })
            }\n\n`),
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

    const head = await kv.get<ChatHead>(key);
    if (!head.value) return ctx.renderNotFound();

    const messages = await batchLoadMessages(
      kv,
      ctx.params.workspaceId,
      head.value.messages ?? [],
    );

    return Response.json({ head: head.value, messages, availableBackends });
  },

  async POST(req: Request, ctx: FreshContext) {
    const { text, boundary } = await req.json();
    if (typeof text !== "string" || text.length === 0 || text.length > 16384) {
      return Response.json({ error: "invalid text" }, { status: 400 });
    }
    if (boundary !== undefined && typeof boundary !== "boolean") {
      return Response.json({ error: "invalid boundary" }, { status: 400 });
    }

    const userMessageId = ulid();
    const assistantMessageId = ulid();
    const headKey = [
      "heads",
      ctx.params.workspaceId,
      ctx.params.chatId,
    ];
    const head = await kv.get<ChatHead>(headKey);
    if (!head.value) return ctx.renderNotFound();

    if (!head.value.messages) head.value.messages = [];

    if (
      boundary && head.value.messages[head.value.messages.length - 1] !== ""
    ) head.value.messages.push("");
    head.value.messages.push(userMessageId, assistantMessageId);

    const userMessage: ChatMessage = {
      id: userMessageId,
      role: "user",
      text,
      timestamp: Date.now(),
      completed: true,
    };
    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
      timestamp: Date.now(),
      completed: false,
    };

    const assistantMessageKey = [
      "messages",
      ctx.params.workspaceId,
      assistantMessageId,
    ];

    const { ok } = await kv.atomic().check(head).set(head.key, head.value).set([
      "messages",
      ctx.params.workspaceId,
      userMessageId,
    ], userMessage).set(assistantMessageKey, assistantMessage).commit();
    if (!ok) return Response.json({ error: "conflict" }, { status: 409 });

    (async () => {
      head.value.messages?.pop(); // remove the incomplete assistant reply

      const streamWithInfo = await generateChatCompletions(
        kv,
        ctx.params.workspaceId,
        head.value,
      );
      if (!streamWithInfo) {
        assistantMessage.interrupted = true;
        assistantMessage.completed = true;
        await kv.set(assistantMessageKey, assistantMessage);
        return;
      }
      const { stream, backendName } = streamWithInfo;
      assistantMessage.backend = backendName;

      let ongoingSet: Promise<void> | null = null;
      let stop = false;

      for await (const chunk of stream) {
        if (stop) {
          stream.controller.abort();
          break;
        }
        const content = chunk.choices[0]?.delta.content ?? "";
        assistantMessage.text += content;
        assistantMessage.timestamp = Date.now();
        assistantMessage.completed = !!chunk.choices[0]?.finish_reason;
        if (!ongoingSet) {
          ongoingSet = Promise.all([
            kv.set(assistantMessageKey, assistantMessage),
            kv.get<ChatHead>(headKey),
          ]).then(([_setRes, head]) => {
            ongoingSet = null;
            stop = !head.value?.messages?.find((x) => x === assistantMessageId);
          });
        }
      }
      await ongoingSet;

      if (!assistantMessage.completed) {
        assistantMessage.interrupted = true;
        assistantMessage.completed = true;
      }
      await kv.set(assistantMessageKey, assistantMessage);
    })().catch((e) => {
      console.log(`generation failed (chat ${ctx.params.chatId}): ${e}`);
    });

    return Response.json({ ok: true });
  },

  async DELETE(_req: Request, ctx: FreshContext) {
    const headKey = [
      "heads",
      ctx.params.workspaceId,
      ctx.params.chatId,
    ];

    await kv.delete(headKey);
    return Response.json({ ok: true });
  },

  async PATCH(req: Request, ctx: FreshContext) {
    const { title, systemPrompt, deletedMessages, backend } = await req.json();
    if (
      title !== undefined && (typeof title !== "string" || title.length === 0)
    ) {
      return Response.json({ error: "invalid title" }, { status: 400 });
    }
    if (
      systemPrompt !== undefined &&
      (typeof systemPrompt !== "string" || systemPrompt.length === 0)
    ) {
      return Response.json({ error: "invalid systemPrompt" }, { status: 400 });
    }
    if (
      deletedMessages !== undefined &&
      (!Array.isArray(deletedMessages) ||
        deletedMessages.findIndex((x) =>
            typeof x !== "string" || x.length === 0
          ) !== -1)
    ) {
      return Response.json({ error: "invalid deletedMessages" }, {
        status: 400,
      });
    }
    if (
      backend !== undefined &&
      (typeof backend !== "string" || !isValidBackendName(backend))
    ) {
      return Response.json({ error: "invalid backend" }, { status: 400 });
    }

    const headKey = [
      "heads",
      ctx.params.workspaceId,
      ctx.params.chatId,
    ];
    const head = await kv.get<ChatHead>(headKey);
    if (!head.value) return ctx.renderNotFound();

    if (title !== undefined) head.value.title = title;
    if (systemPrompt !== undefined) head.value.systemPrompt = systemPrompt;
    if (deletedMessages !== undefined) {
      const deletedMessagesSet = new Set(deletedMessages);
      head.value.messages = head.value.messages?.filter((x) =>
        !deletedMessagesSet.has(x)
      );

      // 1. All consecutive empty messages (`""`) should be reduced to one
      let lastMessage = "";
      head.value.messages = head.value.messages?.filter((x) => {
        const keep = x !== "" || lastMessage !== "";
        lastMessage = x;
        return keep;
      });
      // 2. Trailing empty messages must be removed
      while (
        head.value.messages &&
        head.value.messages[head.value.messages.length - 1] === ""
      ) {
        head.value.messages.pop();
      }
    }
    if (backend !== undefined) head.value.backend = backend;

    const { ok } = await kv.atomic().check(head).set(headKey, head.value)
      .commit();
    if (!ok) return Response.json({ error: "conflict" }, { status: 409 });

    return Response.json({ ok: true });
  },
};
