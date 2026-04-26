import { useCallback } from "react"
import { useAtomValue } from "jotai"
import { Plus, FileText, FileDiff, Terminal as TerminalIcon, RotateCcw, Search, FolderTree } from "lucide-react"
import { Button } from "../../components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "../../components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip"
import { selectedAgentChatIdAtom } from "../agents/atoms"
import { currentPlanPathAtomFamily } from "../agents/atoms/index"
import { useAgentSubChatStore } from "../agents/stores/sub-chat-store"
import { useDockApi, addOrFocus, layoutStorageKey } from "../dock"
import { trpc } from "../../lib/trpc"

/**
 * [+] menu in the TopBar — quick-launch new dock panels and reset the layout.
 *
 * The menu is intentionally small today: only the items whose underlying
 * panel components actually work (plan / changes / terminal). File viewer,
 * search, files-tree, and "new chat" land later when those panel types ship.
 */
export function PlusMenu() {
  const dockApi = useDockApi()
  const chatId = useAtomValue(selectedAgentChatIdAtom)
  const activeSubChatId = useAgentSubChatStore((s) => s.activeSubChatId)
  const planPath = useAtomValue(
    currentPlanPathAtomFamily(activeSubChatId ?? chatId ?? ""),
  )

  // Worktree path is needed for the terminal panel's cwd. Pulled lazily —
  // null when no chat selected or remote-only chat.
  const { data: chat } = trpc.chats.get.useQuery(
    { id: chatId ?? "" },
    { enabled: !!chatId },
  )
  const worktreePath = chat?.worktreePath ?? null

  const projectId = chat?.projectId ?? null
  const canOpenPlan = !!chatId && !!planPath && !!dockApi
  const canOpenDiff = !!chatId && !!dockApi
  const canOpenTerminal = !!chatId && !!worktreePath && !!dockApi
  const canOpenSearch = !!projectId && !!dockApi
  const canOpenFilesTree = !!projectId && !!dockApi

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

  const openTerminal = useCallback(() => {
    if (!dockApi || !chatId || !worktreePath) return
    addOrFocus(dockApi, {
      kind: "terminal",
      data: { chatId, cwd: worktreePath, workspaceId: chatId },
    })
  }, [dockApi, chatId, worktreePath])

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
      // Reload the window so both gridview and dockview rebuild from defaults.
      window.location.reload()
    } catch (err) {
      console.warn("[layout] Failed to reset layout:", err)
    }
  }, [])

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Open panel"
              style={{
                // @ts-expect-error - WebKit-specific: button must not drag the window
                WebkitAppRegion: "no-drag",
              }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">Open a panel</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem disabled={!canOpenTerminal} onClick={openTerminal}>
          <TerminalIcon className="h-4 w-4 mr-2" />
          New Terminal
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canOpenFilesTree} onClick={openFilesTree}>
          <FolderTree className="h-4 w-4 mr-2" />
          Files Tree
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canOpenSearch} onClick={openSearch}>
          <Search className="h-4 w-4 mr-2" />
          Search
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled={!canOpenPlan} onClick={openPlan}>
          <FileText className="h-4 w-4 mr-2" />
          Show Plan
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canOpenDiff} onClick={openDiff}>
          <FileDiff className="h-4 w-4 mr-2" />
          Show Changes
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={resetLayout}>
          <RotateCcw className="h-4 w-4 mr-2" />
          Reset layout
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
