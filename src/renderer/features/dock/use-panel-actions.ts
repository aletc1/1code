import { useCallback } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import {
  selectedAgentChatIdAtom,
  currentPlanPathAtomFamily,
} from "../agents/atoms"
import { useAgentSubChatStore } from "../agents/stores/sub-chat-store"
import {
  terminalsAtom,
  activeTerminalIdAtom,
} from "../terminal/atoms"
import {
  buildTerminalPaneId,
  generateTerminalId,
  getNextTerminalName,
  getTerminalScopeKey,
} from "../terminal/utils"
import { trpc } from "../../lib/trpc"
import { useDockApi } from "./dock-context"
import { addOrFocus } from "./add-or-focus"
import { layoutStorageKey } from "./persistence"
import type { TerminalInstance } from "../terminal/types"

export interface PanelActions {
  available: boolean
  // Action availability
  canFocusChat: boolean
  canOpenTerminal: boolean
  canOpenPlan: boolean
  canOpenDiff: boolean
  canOpenSearch: boolean
  canOpenFilesTree: boolean
  // Action triggers
  focusChat: () => void
  openTerminal: () => void
  openPlan: () => void
  openDiff: () => void
  openSearch: () => void
  openFilesTree: () => void
  resetLayout: () => void
}

/**
 * Single source of truth for "open a panel" actions wired across the app —
 * TopBar quick-launch buttons, dockview header [+] menu, future hotkeys.
 *
 * Each `open*` is a no-op when the underlying entity isn't available; the
 * matching `can*` flag tells the caller whether to render the trigger as
 * enabled or disabled.
 */
export function usePanelActions(): PanelActions {
  const dockApi = useDockApi()
  const chatId = useAtomValue(selectedAgentChatIdAtom)
  const activeSubChatId = useAgentSubChatStore((s) => s.activeSubChatId)
  const planPath = useAtomValue(
    currentPlanPathAtomFamily(activeSubChatId ?? chatId ?? ""),
  )
  const { data: chat } = trpc.chats.get.useQuery(
    { id: chatId ?? "" },
    { enabled: !!chatId },
  )
  const worktreePath = chat?.worktreePath ?? null
  const projectId = chat?.projectId ?? null
  const branch = chat?.branch ?? null

  const setTerminals = useSetAtom(terminalsAtom)
  const setActiveTerminalIds = useSetAtom(activeTerminalIdAtom)
  const allTerminals = useAtomValue(terminalsAtom)

  const focusChat = useCallback(() => {
    if (!dockApi) return
    const main = dockApi.getPanel("main")
    if (main) main.api.setActive()
  }, [dockApi])

  const openTerminal = useCallback(() => {
    if (!dockApi || !chatId || !worktreePath) return
    const scopeKey = getTerminalScopeKey({ id: chatId, branch, worktreePath })
    const list = allTerminals[chatId] ?? []
    const id = generateTerminalId()
    const paneId = buildTerminalPaneId(scopeKey, id)
    const name = getNextTerminalName(list)
    const inst: TerminalInstance = { id, paneId, name, createdAt: Date.now() }
    setTerminals((prev) => ({
      ...prev,
      [chatId]: [...(prev[chatId] ?? []), inst],
    }))
    setActiveTerminalIds((prev) => ({ ...prev, [chatId]: id }))
    addOrFocus(dockApi, {
      kind: "terminal",
      data: { paneId, name, chatId, cwd: worktreePath, workspaceId: chatId },
    })
  }, [
    dockApi,
    chatId,
    worktreePath,
    branch,
    allTerminals,
    setTerminals,
    setActiveTerminalIds,
  ])

  const openPlan = useCallback(() => {
    if (!dockApi || !chatId || !planPath) return
    const effectiveChatId = activeSubChatId ?? chatId
    addOrFocus(dockApi, {
      kind: "plan",
      data: { chatId: effectiveChatId, planPath },
    })
  }, [dockApi, chatId, planPath, activeSubChatId])

  const openDiff = useCallback(() => {
    if (!dockApi || !chatId) return
    addOrFocus(dockApi, { kind: "diff", data: { chatId } })
  }, [dockApi, chatId])

  const openSearch = useCallback(() => {
    if (!dockApi || !projectId) return
    addOrFocus(dockApi, { kind: "search", data: { projectId } })
  }, [dockApi, projectId])

  const openFilesTree = useCallback(() => {
    if (!dockApi || !projectId) return
    addOrFocus(dockApi, { kind: "files-tree", data: { projectId } })
  }, [dockApi, projectId])

  const resetLayout = useCallback(() => {
    try {
      localStorage.removeItem(layoutStorageKey())
      window.location.reload()
    } catch (err) {
      console.warn("[layout] Failed to reset layout:", err)
    }
  }, [])

  return {
    available: !!dockApi,
    canFocusChat: !!dockApi,
    canOpenTerminal: !!chatId && !!worktreePath && !!dockApi,
    canOpenPlan: !!chatId && !!planPath && !!dockApi,
    canOpenDiff: !!chatId && !!dockApi,
    canOpenSearch: !!projectId && !!dockApi,
    canOpenFilesTree: !!projectId && !!dockApi,
    focusChat,
    openTerminal,
    openPlan,
    openDiff,
    openSearch,
    openFilesTree,
    resetLayout,
  }
}
