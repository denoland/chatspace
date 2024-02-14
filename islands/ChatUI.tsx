import { useEffect, useMemo, useState } from "preact/hooks";
import {
  createWorkspaceState,
  WorkspaceInfo,
  WorkspaceStateContext,
} from "../lib/workspace.ts";
import { NewChat, SidebarContent } from "./Sidebar.tsx";
import { ChatContent } from "./ChatContent.tsx";

export function ChatUI(
  { workspaceId, workspaceInfo }: {
    workspaceId: string;
    workspaceInfo: WorkspaceInfo;
  },
) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const state = useMemo(
    () => createWorkspaceState(workspaceId, workspaceInfo),
    [],
  );

  useEffect(() => {
    const callback = () => {
      state.currentHead.value = location.hash.slice(1);
      setIsSidebarOpen(false);
    };
    callback();
    globalThis.addEventListener("hashchange", callback);
    return () => globalThis.removeEventListener("hashchange", callback);
  }, []);

  return (
    <WorkspaceStateContext.Provider value={state}>
      <div class="flex flex-col sm:flex-row">
        <div class="flex flex-row items-start sm:hidden p-3 h-16">
          <button
            class="w-4 text-xl leading-10"
            onClick={toggleSidebar}
          >
            ☰
          </button>
          <div class="flex-grow"></div>
          <NewChat white />
        </div>
        <div
          class={`sm:w-1/4 bg-gray-200 sm:max-w-xs h-screen ${
            isSidebarOpen ? "block" : "hidden"
          } sm:block`}
        >
          <SidebarContent />
        </div>
        <div class="w-full sm:w-3/4 bg-gray-100 flex-grow h-screen">
          <ChatContent />
        </div>
      </div>
    </WorkspaceStateContext.Provider>
  );
}
