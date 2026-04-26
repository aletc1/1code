"use client"

import { useCallback, useEffect, useMemo } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { ArrowUpRight, TerminalSquare, Box, ListTodo, GitPullRequest, Activity, PlayCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  IconDoubleChevronRight,
  PlanIcon,
  DiffIcon,
  OriginalMCPIcon,
} from "@/components/ui/icons"
import { Kbd } from "@/components/ui/kbd"
import { cn } from "@/lib/utils"
import { useResolvedHotkeyDisplay } from "@/lib/hotkeys"
import {
  detailsSidebarOpenAtom,
  widgetVisibilityAtomFamily,
  widgetOrderAtomFamily,
  WIDGET_REGISTRY,
  type WidgetId,
} from "./atoms"
import { WidgetSettingsPopup } from "./widget-settings-popup"
import { InfoSection } from "./sections/info-section"
import { TodoWidget } from "./sections/todo-widget"
import { TasksWidget } from "./sections/tasks-widget"
import { PlanWidget } from "./sections/plan-widget"
import { TerminalWidget } from "./sections/terminal-widget"
import { ChangesWidget } from "./sections/changes-widget"
import { McpWidget } from "./sections/mcp-widget"
import { PrWidget } from "./sections/pr-widget"
import { ScriptsWidget } from "./sections/scripts-widget"
import { getTerminalScopeKey } from "../terminal/utils"
import { trpc } from "../../lib/trpc"
import type { ParsedDiffFile } from "./types"
import { type AgentMode } from "../agents/atoms"
import {
  agentsSettingsDialogOpenAtom,
  agentsSettingsDialogActiveTabAtom,
  selectedProjectAtom,
} from "@/lib/atoms"

// ============================================================================
// WidgetCard — extracted as a real component to avoid remounts
// ============================================================================

function getWidgetIcon(widgetId: WidgetId) {
  switch (widgetId) {
    case "info":
      return Box
    case "tasks":
      return Activity
    case "todo":
      return ListTodo
    case "plan":
      return PlanIcon
    case "terminal":
      return TerminalSquare
    case "diff":
      return DiffIcon
    case "mcp":
      return OriginalMCPIcon
    case "pr":
      return GitPullRequest
    case "scripts":
      return PlayCircle
    default:
      return Box
  }
}

function WidgetCard({
  widgetId,
  title,
  badge,
  children,
  customHeader,
  headerBg,
  hideExpand,
  onExpand,
}: {
  widgetId: WidgetId
  title: string
  badge?: React.ReactNode
  children: React.ReactNode
  customHeader?: React.ReactNode
  headerBg?: string
  hideExpand?: boolean
  onExpand?: () => void
}) {
  const Icon = getWidgetIcon(widgetId)
  const config = WIDGET_REGISTRY.find((w) => w.id === widgetId)
  const canExpand = (config?.canExpand ?? false) && !hideExpand && !!onExpand

  return (
    <div className="mx-2 mb-2">
      <div className="rounded-lg border border-border/50 overflow-hidden">
        <div
          className={cn(
            "flex items-center gap-2 px-2 h-8 select-none group",
            !headerBg && "bg-muted/30",
          )}
          style={headerBg ? { backgroundColor: headerBg } : undefined}
        >
          {customHeader ? (
            <div className="flex-1 min-w-0 flex items-center gap-1">
              {customHeader}
            </div>
          ) : (
            <>
              <Icon className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <span className="text-xs font-medium text-foreground flex-1">
                {title}
              </span>
              {badge}
            </>
          )}
          {canExpand && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onExpand}
                  className="h-5 w-5 p-0 hover:bg-foreground/10 text-muted-foreground hover:text-foreground rounded-md opacity-0 group-hover:opacity-100 transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0"
                  aria-label={`Expand ${widgetId}`}
                >
                  <ArrowUpRight className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left">Expand to sidebar</TooltipContent>
            </Tooltip>
          )}
        </div>
        <div>{children}</div>
      </div>
    </div>
  )
}

// ============================================================================
// DetailsSidebar
// ============================================================================

interface DetailsSidebarProps {
  /** Workspace/chat ID */
  chatId: string
  /** Worktree path for terminal */
  worktreePath: string | null
  /** Plan path for plan section */
  planPath: string | null
  /** Current agent mode (plan or agent) */
  mode: AgentMode
  /** Callback when "Build plan" is clicked */
  onBuildPlan?: () => void
  /** Plan refetch trigger */
  planRefetchTrigger?: number
  /** Active sub-chat ID for plan */
  activeSubChatId?: string | null
  /** Sidebar open states - used to hide widgets when their sidebar is open */
  isPlanSidebarOpen?: boolean
  isTerminalSidebarOpen?: boolean
  isDiffSidebarOpen?: boolean
  /** Diff display mode - only hide widget when in side-peek mode */
  diffDisplayMode?: "side-peek" | "center-peek" | "full-page"
  /** Diff-related props */
  canOpenDiff: boolean
  setIsDiffSidebarOpen: (open: boolean) => void
  diffStats?: { additions: number; deletions: number; fileCount: number } | null
  /** Parsed diff files for file list */
  parsedFileDiffs?: ParsedDiffFile[] | null
  /** Callback to commit selected changes */
  onCommit?: (selectedPaths: string[]) => void
  /** Callback to commit and push selected changes */
  onCommitAndPush?: (selectedPaths: string[]) => void
  /** Whether commit is in progress */
  isCommitting?: boolean
  /** Git sync status for push/pull actions */
  gitStatus?: { pushCount?: number; pullCount?: number; hasUpstream?: boolean } | null
  /** Whether git sync status is loading */
  isGitStatusLoading?: boolean
  /** Current branch name for header */
  currentBranch?: string
  /** Callbacks to expand widgets to legacy sidebars */
  onExpandTerminal?: () => void
  onExpandPlan?: () => void
  onExpandDiff?: () => void
  /** Callback when a file is selected in Changes widget - opens diff with file selected */
  onFileSelect?: (filePath: string) => void
  /** Callback when a file is opened from Files tab - opens in file viewer */
  onOpenFile?: (absolutePath: string) => void
  /** Remote chat info for sandbox workspaces */
  remoteInfo?: {
    repository?: string
    branch?: string | null
    sandboxId?: string
  } | null
  /** Whether this is a remote sandbox chat (no local worktree) */
  isRemoteChat?: boolean
}

export function DetailsSidebar({
  chatId,
  worktreePath,
  planPath,
  mode,
  onBuildPlan,
  planRefetchTrigger,
  activeSubChatId,
  isPlanSidebarOpen,
  isTerminalSidebarOpen,
  isDiffSidebarOpen,
  diffDisplayMode,
  canOpenDiff,
  setIsDiffSidebarOpen,
  diffStats,
  parsedFileDiffs,
  onCommit,
  onCommitAndPush,
  isCommitting,
  gitStatus,
  isGitStatusLoading,
  currentBranch,
  onExpandTerminal,
  onExpandPlan,
  onExpandDiff,
  onFileSelect,
  onOpenFile,
  remoteInfo,
  isRemoteChat = false,
}: DetailsSidebarProps) {
  // Global sidebar open state — gridview right cell visibility tracks this.
  const [isOpen, setIsOpen] = useAtom(detailsSidebarOpenAtom)

  // Settings dialog atoms for MCP settings
  const setSettingsOpen = useSetAtom(agentsSettingsDialogOpenAtom)
  const setSettingsTab = useSetAtom(agentsSettingsDialogActiveTabAtom)

  const handleOpenMcpSettings = useCallback(() => {
    setSettingsTab("mcp")
    setSettingsOpen(true)
  }, [setSettingsTab, setSettingsOpen])

  // Fetch chat to derive projectId + terminal scope for the Scripts widget
  const { data: chatData } = trpc.chats.get.useQuery({ id: chatId })
  const projectIdForScripts = chatData?.projectId ?? null
  const scriptsScopeKey = useMemo(
    () =>
      getTerminalScopeKey({
        id: chatId,
        branch: chatData?.branch ?? null,
        worktreePath,
      }),
    [chatId, chatData?.branch, worktreePath],
  )

  // Pre-select the right project when opening settings from the Scripts widget
  // so the user doesn't have to find it manually in the project list.
  const setSelectedProject = useSetAtom(selectedProjectAtom)
  const handleOpenScriptsSettings = useCallback(() => {
    if (chatData?.project) {
      setSelectedProject({
        id: chatData.project.id,
        name: chatData.project.name,
        path: chatData.project.path,
        gitRemoteUrl: chatData.project.gitRemoteUrl ?? null,
        gitProvider: (chatData.project.gitProvider as "github" | "gitlab" | "bitbucket" | null) ?? null,
        gitOwner: chatData.project.gitOwner ?? null,
        gitRepo: chatData.project.gitRepo ?? null,
      })
    }
    setSettingsTab("projects")
    setSettingsOpen(true)
  }, [chatData?.project, setSelectedProject, setSettingsTab, setSettingsOpen])

  // Per-workspace widget visibility
  const widgetVisibilityAtom = useMemo(
    () => widgetVisibilityAtomFamily(chatId),
    [chatId],
  )
  const visibleWidgets = useAtomValue(widgetVisibilityAtom)

  // Per-workspace widget order
  const widgetOrderAtom = useMemo(
    () => widgetOrderAtomFamily(chatId),
    [chatId],
  )
  const widgetOrder = useAtomValue(widgetOrderAtom)

  // Close sidebar callback
  const closeSidebar = useCallback(() => {
    setIsOpen(false)
  }, [setIsOpen])

  // Resolved hotkeys for tooltips
  const toggleDetailsHotkey = useResolvedHotkeyDisplay("toggle-details")

  // Check if a widget should be shown
  const isWidgetVisible = useCallback(
    (widgetId: WidgetId) => visibleWidgets.includes(widgetId),
    [visibleWidgets],
  )

  // Keyboard shortcut: Cmd+Shift+\ to toggle details sidebar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.metaKey &&
        e.shiftKey &&
        !e.altKey &&
        !e.ctrlKey &&
        e.code === "Backslash"
      ) {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(!isOpen)
      }
    }

    window.addEventListener("keydown", handleKeyDown, true)
    return () => window.removeEventListener("keydown", handleKeyDown, true)
  }, [setIsOpen, isOpen])

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden bg-background">
      {/* Header — close button + Edit Widgets popup. The Files / Search tabs
          previously here are now first-class dockview panels (see [+] menu in
          the dock header). */}
      <div
        className="flex items-center justify-between px-2 h-10 flex-shrink-0 border-b border-border/50"
        style={{
          // @ts-expect-error - WebKit-specific property
          WebkitAppRegion: "no-drag",
        }}
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={closeSidebar}
              className="h-6 w-6 p-0 hover:bg-foreground/10 text-foreground flex-shrink-0 rounded-md"
              aria-label="Close details"
            >
              <IconDoubleChevronRight className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Close details
            {toggleDetailsHotkey && <Kbd>{toggleDetailsHotkey}</Kbd>}
          </TooltipContent>
        </Tooltip>

        <WidgetSettingsPopup workspaceId={chatId} isRemoteChat={isRemoteChat} />
      </div>

      {/* Widget list */}
      <div className="flex-1 overflow-y-auto py-2">
          {widgetOrder.map((widgetId) => {
            // Skip if widget is not visible
            if (!isWidgetVisible(widgetId)) return null

            switch (widgetId) {
              case "info":
                return (
                  <WidgetCard key="info" widgetId="info" title="Workspace">
                    <InfoSection
                      chatId={chatId}
                      worktreePath={worktreePath}
                      remoteInfo={remoteInfo}
                    />
                  </WidgetCard>
                )

              case "tasks":
                return (
                  <TasksWidget key="tasks" subChatId={activeSubChatId || null} />
                )

              case "todo":
                return (
                  <TodoWidget key="todo" subChatId={activeSubChatId || null} />
                )

              case "plan":
                // Hidden when Plan sidebar is open
                if (!planPath || isPlanSidebarOpen) return null
                return (
                  <PlanWidget
                    key="plan"
                    chatId={chatId}
                    activeSubChatId={activeSubChatId}
                    planPath={planPath}
                    refetchTrigger={planRefetchTrigger}
                    mode={mode}
                    onApprovePlan={onBuildPlan}
                    onExpandPlan={onExpandPlan}
                  />
                )

              case "terminal":
                // Hidden when Terminal sidebar is open
                if (!worktreePath || isTerminalSidebarOpen) return null
                return (
                  <TerminalWidget
                    key="terminal"
                    chatId={chatId}
                    cwd={worktreePath}
                    workspaceId={chatId}
                    onExpand={onExpandTerminal}
                  />
                )

              case "diff":
                // Show widget if we have diff stats (local or remote)
                // Hide only when Diff sidebar is open in side-peek mode
                const hasDiffStats = !!diffStats && (diffStats.fileCount > 0 || diffStats.additions > 0 || diffStats.deletions > 0)
                const canShowDiffWidget = canOpenDiff || (isRemoteChat && hasDiffStats)
                if (!canShowDiffWidget || (isDiffSidebarOpen && diffDisplayMode === "side-peek")) return null
                return (
                  <ChangesWidget
                    key="diff"
                    chatId={chatId}
                    worktreePath={worktreePath}
                    diffStats={diffStats}
                    parsedFileDiffs={parsedFileDiffs}
                    onCommit={onCommit}
                    onCommitAndPush={onCommitAndPush}
                    isCommitting={isCommitting}
                    pushCount={gitStatus?.pushCount ?? 0}
                    pullCount={gitStatus?.pullCount ?? 0}
                    hasUpstream={gitStatus?.hasUpstream ?? true}
                    isSyncStatusLoading={isGitStatusLoading}
                    currentBranch={currentBranch}
                    // For remote chats on desktop, don't provide expand/file actions
                    onExpand={canOpenDiff ? onExpandDiff : undefined}
                    onFileSelect={canOpenDiff ? onFileSelect : undefined}
                    diffDisplayMode={diffDisplayMode}
                  />
                )

              case "pr":
                // Only show for local chats with a worktree
                if (!worktreePath) return null
                return (
                  <WidgetCard key="pr" widgetId="pr" title="Pull Request">
                    <PrWidget chatId={chatId} />
                  </WidgetCard>
                )

              case "mcp":
                return (
                  <WidgetCard
                    key="mcp"
                    widgetId="mcp"
                    title="MCP Servers"
                    badge={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleOpenMcpSettings}
                            className="h-5 w-5 p-0 hover:bg-foreground/10 text-muted-foreground hover:text-foreground rounded-md opacity-0 group-hover:opacity-100 transition-[background-color,opacity] duration-150 ease-out flex-shrink-0"
                            aria-label="MCP Settings"
                          >
                            <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Open settings</TooltipContent>
                      </Tooltip>
                    }
                    hideExpand
                  >
                    <McpWidget />
                  </WidgetCard>
                )

              case "scripts":
                if (!worktreePath) return null
                return (
                  <WidgetCard
                    key="scripts"
                    widgetId="scripts"
                    title="Scripts"
                    badge={
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleOpenScriptsSettings}
                            className="h-5 w-5 p-0 hover:bg-foreground/10 text-muted-foreground hover:text-foreground rounded-md opacity-0 group-hover:opacity-100 transition-[background-color,opacity] duration-150 ease-out flex-shrink-0"
                            aria-label="Manage scripts"
                          >
                            <ArrowUpRight className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="left">Manage scripts</TooltipContent>
                      </Tooltip>
                    }
                    hideExpand
                  >
                    <ScriptsWidget
                      chatId={chatId}
                      projectId={projectIdForScripts}
                      worktreePath={worktreePath}
                      scopeKey={scriptsScopeKey}
                      onOpenSettings={handleOpenScriptsSettings}
                    />
                  </WidgetCard>
                )

              default:
                return null
            }
          })}
      </div>
    </div>
  )
}
