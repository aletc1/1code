import { useEffect, useMemo, useState } from "react"
import type { IDockviewPanelProps } from "dockview-react"
import { useAgentSubChatStore } from "../../agents/stores/sub-chat-store"
import { AgentsContent } from "../../agents/ui/agents-content"
import type { ChatPanelEntity } from "../atoms"

/**
 * ChatPanel — one dockview tab per open sub-chat. Each tab carries
 * `subChatId + chatId` in its params; the panel renders `<AgentsContent />`
 * which mounts ChatView for the parent chat. When this panel becomes the
 * active dockview panel, it pushes its `subChatId` into the sub-chat
 * store so ChatView shows the matching content.
 *
 * Inactive tabs render `<AgentsContent />` invisibly (opacity 0,
 * pointer-events: none) so chat streams / UI state stay warm — switching
 * tabs is then a CSS toggle, not a remount. ChatView itself reads
 * `activeSubChatId` from the store and renders the matching sub-chat,
 * so we let the store be the single source of truth and don't try to
 * pin the rendered sub-chat to the panel's params.
 *
 * The opposite direction (store activeSubChatId / openSubChatIds → dockview)
 * lives in [chat-panel-sync.tsx]. The two effects converge through the
 * store; dockview is the UI surface.
 */
export function ChatPanel({
  params,
  api,
}: IDockviewPanelProps<ChatPanelEntity>) {
  const [isActive, setIsActive] = useState(api.isActive)
  const setActiveSubChat = useAgentSubChatStore((s) => s.setActiveSubChat)
  const allSubChats = useAgentSubChatStore((s) => s.allSubChats)

  // Track active state from dockview so we know whether to mount the chat
  // surface or a placeholder.
  useEffect(() => {
    setIsActive(api.isActive)
    const sub = api.onDidActiveChange((e) => setIsActive(e.isActive))
    return () => sub.dispose()
  }, [api])

  // When this panel becomes active, sync `activeSubChatId` so the rendered
  // ChatView shows this sub-chat. The reverse direction (store → dockview
  // active panel) is handled by ChatPanelSync.
  useEffect(() => {
    if (isActive) {
      setActiveSubChat(params.subChatId)
    }
  }, [isActive, params.subChatId, setActiveSubChat])

  // Keep the dockview tab title in sync with the sub-chat's display name.
  // The store's allSubChats array is the source of truth for names.
  const latestName = useMemo(() => {
    const sc = allSubChats.find((x) => x.id === params.subChatId)
    return sc?.name ?? params.name ?? "Conversation"
  }, [allSubChats, params.subChatId, params.name])

  useEffect(() => {
    if (latestName && latestName !== api.title) {
      api.setTitle(latestName)
    }
  }, [latestName, api])

  // Render AgentsContent regardless of active state (keeps chat state warm)
  // but hide non-active panels so only one is interactive / visible. This
  // matches the existing SplitDropZone pattern in active-chat.tsx.
  return (
    <div
      className="h-full w-full overflow-hidden bg-background"
      style={{
        opacity: isActive ? 1 : 0,
        pointerEvents: isActive ? "auto" : "none",
        contain: "layout style paint",
      }}
      aria-hidden={!isActive}
    >
      {isActive ? <AgentsContent /> : null}
    </div>
  )
}
