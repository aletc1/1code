import { useEffect } from "react"
import { useAtomValue } from "jotai"
import { selectedAgentChatIdAtom } from "../agents/atoms"
import { useAgentSubChatStore } from "../agents/stores/sub-chat-store"
import { useDockApi } from "./dock-context"

/**
 * ChatPanelSync — keeps the dockview's `chat:*` panels in lockstep with the
 * sub-chat store's `openSubChatIds` / `activeSubChatId`.
 *
 * Responsibilities:
 * 1. When the user picks a chat in the left rail (selectedAgentChatId
 *    changes): close the singleton "main" placeholder and open one
 *    `chat:${subChatId}` panel for every entry in `openSubChatIds`.
 * 2. When the store's open list changes (a new sub-chat is opened, an old
 *    one is closed via the rail): mirror that into dockview by adding /
 *    closing panels.
 * 3. When `activeSubChatId` changes from outside dockview (e.g. via a
 *    click in the chats list, or programmatic switch): make the matching
 *    panel the active dockview panel.
 *
 * The opposite direction (dockview tab close → store, dockview tab focus
 * → store) is handled inside ChatPanel + DockShell.onDidRemovePanel so
 * the user's interactions with native tabs feed back into the store.
 *
 * This component renders nothing — it's purely an effect host. Mount it
 * inside the dock provider tree.
 */
export function ChatPanelSync() {
  const dockApi = useDockApi()
  const selectedChatId = useAtomValue(selectedAgentChatIdAtom)
  const openSubChatIds = useAgentSubChatStore((s) => s.openSubChatIds)
  const activeSubChatId = useAgentSubChatStore((s) => s.activeSubChatId)
  const allSubChats = useAgentSubChatStore((s) => s.allSubChats)

  // (1) No chat selected → ensure "main" placeholder, drop any chat panels.
  useEffect(() => {
    if (!dockApi || selectedChatId) return
    for (const panel of dockApi.panels) {
      if (panel.id.startsWith("chat:")) panel.api.close()
    }
    if (!dockApi.getPanel("main")) {
      dockApi.addPanel({
        id: "main",
        component: "main",
        title: "Workspace",
      })
    }
  }, [dockApi, selectedChatId])

  // (2) Chat selected → sync openSubChatIds with chat: panels.
  useEffect(() => {
    if (!dockApi || !selectedChatId) return

    // Drop the "main" placeholder once we have at least one sub-chat.
    if (openSubChatIds.length > 0) {
      const main = dockApi.getPanel("main")
      if (main) main.api.close()
    }

    // Open panels for any sub-chat that's in the store but not in dockview.
    for (const subChatId of openSubChatIds) {
      const id = `chat:${subChatId}`
      if (dockApi.getPanel(id)) continue
      const sc = allSubChats.find((x) => x.id === subChatId)
      dockApi.addPanel({
        id,
        component: "chat",
        title: sc?.name || "Conversation",
        params: {
          subChatId,
          chatId: selectedChatId,
          name: sc?.name,
        },
      })
    }

    // Close panels whose sub-chat is no longer in the open list.
    for (const panel of dockApi.panels) {
      if (!panel.id.startsWith("chat:")) continue
      const subChatId = panel.id.slice("chat:".length)
      if (!openSubChatIds.includes(subChatId)) {
        panel.api.close()
      }
    }
  }, [dockApi, selectedChatId, openSubChatIds, allSubChats])

  // (3) activeSubChatId → make matching panel the active dockview panel.
  useEffect(() => {
    if (!dockApi || !activeSubChatId) return
    const panel = dockApi.getPanel(`chat:${activeSubChatId}`)
    if (panel && !panel.api.isActive) panel.api.setActive()
  }, [dockApi, activeSubChatId])

  return null
}
