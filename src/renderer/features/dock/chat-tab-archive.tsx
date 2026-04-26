import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../components/ui/alert-dialog"
import { useAgentSubChatStore } from "../agents/stores/sub-chat-store"
import { trpc } from "../../lib/trpc"
import { useDockApi } from "./dock-context"

/**
 * "Archive chat" flow for the X on a chat: tab.
 *
 * Mirrors `handleArchiveSubChat` from agents-subchats-sidebar:
 * - When closing one of *several* open sub-chats, removeFromOpenSubChats is
 *   enough — the sub-chat stays in `allSubChats` for history, the panel
 *   closes (via DockShell.onDidRemovePanel) and Cmd+Z can reopen it.
 * - When closing the *last* open sub-chat there's no chat left to look at,
 *   so we treat it as "archive the workspace": confirm dialog → trpc
 *   archive mutation → store cleanup → all chat panels close.
 *
 * Wiring matches the rename dispatch in [renamable-tab.tsx]: a host
 * component captures the dispatcher into a module-level slot so the
 * dockview tab (rendered outside the React tree by dockview) can call
 * it without prop drilling.
 */

let dispatchArchiveImpl:
  | ((panelId: string) => void)
  | null = null

export function requestArchiveChatTab(panelId: string): void {
  if (dispatchArchiveImpl) dispatchArchiveImpl(panelId)
}

export function ChatTabArchiveHost() {
  const dockApi = useDockApi()
  const archiveChat = trpc.chats.archive.useMutation()
  const [pendingArchive, setPendingArchive] = useState<{
    subChatId: string
    parentChatId: string
    name: string
  } | null>(null)

  const dispatch = useCallback(
    (panelId: string) => {
      if (!panelId.startsWith("chat:")) return
      const subChatId = panelId.slice("chat:".length)
      const store = useAgentSubChatStore.getState()
      const openCount = store.openSubChatIds.length
      // If multiple sub-chats are open, drop just this one — same as the
      // sidebar's handleArchiveSubChat (no dialog, easy undo).
      if (openCount > 1) {
        store.removeFromOpenSubChats(subChatId)
        return
      }
      // Last sub-chat — confirm and then archive the parent workspace.
      const parentChatId = store.chatId
      if (!parentChatId) {
        // No parent context (shouldn't happen) — best-effort silent close.
        store.removeFromOpenSubChats(subChatId)
        return
      }
      const sc = store.allSubChats.find((s) => s.id === subChatId)
      setPendingArchive({
        subChatId,
        parentChatId,
        name: sc?.name || "this chat",
      })
    },
    [],
  )

  useEffect(() => {
    dispatchArchiveImpl = dispatch
    return () => {
      dispatchArchiveImpl = null
    }
  }, [dispatch])

  const handleConfirm = useCallback(() => {
    if (!pendingArchive) return
    const { parentChatId, subChatId } = pendingArchive
    setPendingArchive(null)
    archiveChat
      .mutateAsync({ id: parentChatId })
      .then(() => {
        // Drop the sub-chat from the rail/store; ChatPanelSync closes the
        // dockview panel as a consequence.
        useAgentSubChatStore.getState().removeFromOpenSubChats(subChatId)
        // Close any other chat: panels that belong to this archived
        // workspace too — dockview sees the parent gone via the chats list
        // refresh, but we explicitly close to keep the UI immediate.
        if (dockApi) {
          for (const panel of dockApi.panels) {
            if (panel.id.startsWith("chat:")) panel.api.close()
          }
        }
      })
      .catch((err) => {
        console.error("[archive] Failed to archive workspace:", err)
        toast.error("Failed to archive chat")
      })
  }, [pendingArchive, archiveChat, dockApi])

  const handleCancel = useCallback(() => {
    setPendingArchive(null)
  }, [])

  return (
    <AlertDialog
      open={!!pendingArchive}
      onOpenChange={(open) => {
        if (!open) handleCancel()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Archive chat</AlertDialogTitle>
        </AlertDialogHeader>
        <AlertDialogDescription className="px-5 pb-5">
          Do you want to archive{" "}
          <span className="font-medium text-foreground">
            {pendingArchive?.name ?? "this chat"}
          </span>
          ? You can restore it from history later.
        </AlertDialogDescription>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm} autoFocus>
            Archive
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
