import {
  MutableRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "preact/hooks";
import {
  ChatHead,
  ChatMessage,
  WorkspaceStateContext,
} from "../lib/workspace.ts";
import { fetchOrError } from "../lib/fetch.ts";

export function ChatContent() {
  const state = useContext(WorkspaceStateContext)!;
  const currentHead = state.currentHead.value;
  if (!currentHead) {
    return (
      <div class="flex flex-col p-4 text-center text-gray-600">
        Select a chat
      </div>
    );
  }
  return (
    <div class="flex flex-col h-full">
      <ChatContentForId key={currentHead} chatId={currentHead} />
    </div>
  );
}

function ChatContentForId({ chatId }: { chatId: string }) {
  const state = useContext(WorkspaceStateContext)!;
  const [head, setHead] = useState(null as ChatHead | null);
  const messageCache: MutableRef<Map<string, ChatMessage>> = useRef(new Map());
  const inputRef = useRef(null as HTMLTextAreaElement | null);
  const boundaryCheckboxRef = useRef(null as HTMLInputElement | null);
  const [availableBackends, setAvailableBackends] = useState([] as string[]);

  useEffect(() => {
    const sse = new EventSource(`/api/workspace/${state.id}/chats/${chatId}`);
    sse.onerror = (err) => {
      console.log("Connection Error");
      sse.close();
    };

    sse.onmessage = (event) => {
      const body: {
        head: ChatHead;
        messages: ChatMessage[];
        availableBackends: string[];
      } = JSON.parse(
        event.data,
      );
      for (const m of body.messages) {
        messageCache.current.set(m.id, m);
      }
      if (!body.head.backend) {
        body.head.backend = availableBackends[0];
      }
      setHead(body.head);
      setAvailableBackends(body.availableBackends);
    };

    return () => {
      sse.close();
    };
  }, [state.id, chatId]);

  const [editingTitle, setEditingTitle] = useState(null as string | null);
  const [editingSystemPrompt, setEditingSystemPrompt] = useState(
    null as
      | string
      | null,
  );
  const bottomRef = useRef(null as HTMLDivElement | null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "instant" });
  }, [head?.messages ? head.messages[head.messages.length - 1] : ""]);

  const backendSelector = useRef(null as HTMLSelectElement | null);

  const sendInput = async () => {
    const content = inputRef.current?.value?.trim() ?? "";
    if (!content) return;

    await fetchOrError(
      `/api/workspace/${state.id}/chats/${chatId}`,
      {
        method: "POST",
        body: {
          text: content,
          boundary: !!boundaryCheckboxRef.current?.checked,
        },
      },
    );

    if (inputRef.current) inputRef.current.value = "";
    if (boundaryCheckboxRef.current) {
      boundaryCheckboxRef.current.checked = false;
    }
  };

  if (!head) return <div></div>;
  return (
    <div class="h-full">
      <div
        class="flex flex-col p-4 pb-0 bg-white"
        style={{ height: "calc(100% - 5rem)" }}
      >
        <div class="flex flex-col items-start mb-4">
          <div class="font-bold text-lg">
            {editingTitle !== null
              ? (
                <input
                  type="text"
                  class="p-2 border border-gray-300 rounded"
                  value={editingTitle}
                  onChange={(e) => {
                    setEditingTitle((e.target as HTMLInputElement).value);
                  }}
                  onBlur={async () => {
                    await fetchOrError(
                      `/api/workspace/${state.id}/chats/${chatId}`,
                      {
                        method: "PATCH",
                        body: {
                          title: editingTitle,
                        },
                      },
                    );
                    setEditingTitle(null);
                  }}
                />
              )
              : (
                <span
                  class="cursor-pointer"
                  onClick={() => {
                    setEditingTitle(head.title);
                  }}
                >
                  {head.title}
                </span>
              )}
          </div>
          <div class="flex flex-row items-center gap-4">
            <div class="text-sm text-gray-400">
              {new Date(head.timestamp).toLocaleString()}
            </div>

            <div class="text-sm">
              <select
                class="bg-gray-50 disabled:bg-gray-200 border border-gray-300 text-gray-900 text-sm rounded focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                ref={backendSelector}
                value={head.backend}
                onChange={async (e) => {
                  const newBackend = (e.target as HTMLSelectElement).value;
                  if (backendSelector.current) {
                    backendSelector.current.disabled = true;
                  }
                  await fetchOrError(
                    `/api/workspace/${state.id}/chats/${chatId}`,
                    {
                      method: "PATCH",
                      body: {
                        backend: newBackend,
                      },
                    },
                  );
                  if (backendSelector.current) {
                    backendSelector.current.disabled = false;
                  }
                }}
              >
                {availableBackends.map((b) => <option value={b}>{b}</option>)}
              </select>
            </div>
          </div>
          <div class="text-sm text-gray-500 w-full">
            {editingSystemPrompt !== null
              ? (
                <input
                  type="text"
                  class="p-2 border border-gray-300 rounded w-full"
                  value={editingSystemPrompt}
                  onChange={(e) => {
                    setEditingSystemPrompt(
                      (e.target as HTMLInputElement).value,
                    );
                  }}
                  onBlur={async () => {
                    await fetchOrError(
                      `/api/workspace/${state.id}/chats/${chatId}`,
                      {
                        method: "PATCH",
                        body: {
                          systemPrompt: editingSystemPrompt,
                        },
                      },
                    );
                    setEditingSystemPrompt(null);
                  }}
                />
              )
              : (
                <span
                  class="cursor-pointer"
                  onClick={() => {
                    setEditingSystemPrompt(head.systemPrompt);
                  }}
                >
                  {head.systemPrompt}
                </span>
              )}
          </div>
        </div>

        <div class="flex flex-col space-y-2 overflow-y-auto">
          {head.messages?.map((id, i) => {
            if (!id) {
              // boundary
              return (
                <div class="text-gray-400 border-gray-400 text-sm border-b">
                  New conversation
                </div>
              );
            }
            const message = messageCache.current.get(id);
            if (!message) return null;
            return (
              <MessageView
                key={id}
                chatId={head.id}
                message={message}
                forceCompleted={i !== head.messages!.length - 1}
              />
            );
          })}
          <div ref={bottomRef}></div>
        </div>
      </div>
      <div class="h-20 overflow-y-auto px-2">
        <div class="flex flex-row mt-2">
          <textarea
            ref={inputRef}
            class="flex-grow p-2 border border-gray-300 outline-none mr-2 rounded"
            rows={1}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendInput();
              }
            }}
          />
          <button
            class="bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded"
            onClick={sendInput}
          >
            Send
          </button>
        </div>

        <div class="flex flex-row mt-2 text-xs gap-2">
          <input type="checkbox" ref={boundaryCheckboxRef} />
          <p>Start a new conversation</p>
        </div>
      </div>
    </div>
  );
}

function MessageView(
  { chatId, message: initMessage, forceCompleted }: {
    chatId: string;
    message: ChatMessage;
    forceCompleted: boolean;
  },
) {
  const state = useContext(WorkspaceStateContext)!;
  const [message, setMessage] = useState(initMessage);

  useEffect(() => {
    if (initMessage.completed || forceCompleted) return;

    console.log(`connecting to message ${initMessage.id}`);

    const sse = new EventSource(
      `/api/workspace/${state.id}/messages/${initMessage.id}`,
    );
    sse.onerror = (err) => {
      console.log("Connection Error");
      sse.close();
    };

    sse.onmessage = (event) => {
      const body: ChatMessage | null = JSON.parse(
        event.data,
      );
      if (!body) return;
      setMessage(body);
      if (body.completed) {
        console.log(`message completed: ${body.id}`);
        sse.close();
        return;
      }
    };

    return () => {
      sse.close();
    };
  }, [state.id, initMessage.id, forceCompleted]);

  return (
    <div class="flex flex-col items-start p-2 bg-gray-100 rounded">
      <div class="flex flex-row gap-2 text-sm">
        <div class="font-bold">
          {message.role}
          {message.backend ? ` (${message.backend})` : ""}
        </div>
        <div class="text-gray-400">
          {new Date(message.timestamp).toLocaleString()}
        </div>
        <div>
          <button
            onClick={async () => {
              const yes = confirm(
                "Are you sure you want to delete this message?",
              );
              if (!yes) return;

              await fetchOrError(
                `/api/workspace/${state.id}/chats/${chatId}`,
                {
                  method: "PATCH",
                  body: {
                    "deletedMessages": [message.id],
                  },
                },
              );
            }}
            class="underline"
          >
            Delete
          </button>
        </div>
      </div>
      {(message.interrupted ||
          (!message.completed && Date.now() - message.timestamp > 30000))
        ? <div class="text-red-500">Interrupted</div>
        : null}
      <div
        class="flex-grow prose max-w-full overflow-x-auto"
        dangerouslySetInnerHTML={{ __html: message.html ?? "" }}
      >
      </div>
    </div>
  );
}
