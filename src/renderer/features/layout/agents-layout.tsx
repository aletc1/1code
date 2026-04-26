import { useCallback, useContext, useEffect, useState, useMemo, useRef, createContext, type ReactNode } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { toast } from "sonner"
import { useTheme } from "next-themes"
import {
  GridviewReact,
  Orientation,
  LayoutPriority,
  type GridviewApi,
  type GridviewReadyEvent,
  type IGridviewPanelProps,
} from "dockview-react"
import { isDesktopApp } from "../../lib/utils/platform"
import { useIsMobile } from "../../lib/hooks/use-mobile"

import {
  agentsSidebarOpenAtom,
  agentsSidebarWidthAtom,
  agentsSettingsDialogActiveTabAtom,
  agentsSettingsDialogOpenAtom,
  apiKeyOnboardingCompletedAtom,
  billingMethodAtom,
  claudeLoginModalConfigAtom,
  codexOnboardingCompletedAtom,
  isDesktopAtom,
  isFullscreenAtom,
  anthropicOnboardingCompletedAtom,
  customHotkeysAtom,
  betaKanbanEnabledAtom,
} from "../../lib/atoms"
import { selectedAgentChatIdAtom, selectedProjectAtom, selectedDraftIdAtom, showNewChatFormAtom, desktopViewAtom, fileSearchDialogOpenAtom } from "../agents/atoms"
import { trpc } from "../../lib/trpc"
import { useAgentsHotkeys } from "../agents/lib/agents-hotkeys-manager"
import { toggleSearchAtom } from "../agents/search"
import { ClaudeLoginModal } from "../../components/dialogs/claude-login-modal"
import { CodexLoginModal } from "../../components/dialogs/codex-login-modal"
import { TooltipProvider } from "../../components/ui/tooltip"
import { AgentsSidebar } from "../sidebar/agents-sidebar"
import { UpdateBanner } from "../../components/update-banner"
import { WindowsTitleBar } from "../../components/windows-title-bar"
import { DetailsRail } from "./details-rail"
import { SettingsSidebar } from "../settings/settings-sidebar"
import {
  detailsSidebarOpenAtom,
  detailsSidebarWidthAtom,
} from "../details-sidebar/atoms"
import {
  DockShell,
  DockProvider,
  ChatPanelSync,
  RenameDispatchHost,
  loadLayoutSnapshot,
  makeDebouncedSaver,
  tryRestore,
  type DockHandles,
  type AgentsLayoutSnapshot,
} from "../dock"
import type { DockviewApi } from "dockview-react"
import { useUpdateChecker } from "../../lib/hooks/use-update-checker"
import { useAgentSubChatStore } from "../agents/stores/sub-chat-store"
import { QueueProcessor } from "../agents/components/queue-processor"

// ============================================================================
// Constants
// ============================================================================

const SIDEBAR_MIN_WIDTH = 160
const SIDEBAR_MAX_WIDTH = 600
const SIDEBAR_DEFAULT_WIDTH = 240
const DETAILS_RAIL_MIN_WIDTH = 280
const DETAILS_RAIL_MAX_WIDTH = 700
const DETAILS_RAIL_DEFAULT_WIDTH = 460

// ============================================================================
// Shell context — bridges parent state into gridview panel renderers
// ============================================================================

interface ShellContextValue {
  desktopUser: {
    id: string
    email: string
    name: string | null
    imageUrl: string | null
    username: string | null
  } | null
  onSignOut: () => Promise<void>
  onToggleSidebar: () => void
  setDockApi: (api: DockviewApi) => void
  /** Layout snapshot loaded once at mount. Panels read this on dockview-ready
   *  to restore previous arrangement before falling back to defaults. */
  layoutSnapshot: AgentsLayoutSnapshot | null
  /** Schedule a debounced save of the current layout. */
  scheduleLayoutSave: () => void
}

const ShellContext = createContext<ShellContextValue | null>(null)

function ShellProvider({
  value,
  children,
}: {
  value: ShellContextValue
  children: ReactNode
}) {
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>
}

function useShellContext(): ShellContextValue {
  const ctx = useContext(ShellContext)
  if (!ctx) throw new Error("useShellContext must be used inside ShellProvider")
  return ctx
}

// ============================================================================
// Gridview panel renderers
// ============================================================================

function LeftRailPanel(_props: IGridviewPanelProps) {
  const { desktopUser, onSignOut, onToggleSidebar } = useShellContext()
  const desktopView = useAtomValue(desktopViewAtom)
  const isSettingsView = desktopView === "settings"

  return (
    <div
      className="h-full w-full overflow-hidden bg-background border-r"
      style={{ borderRightWidth: "0.5px" }}
    >
      {isSettingsView ? (
        <SettingsSidebar />
      ) : (
        <AgentsSidebar
          desktopUser={desktopUser}
          onSignOut={onSignOut}
          onToggleSidebar={onToggleSidebar}
        />
      )}
    </div>
  )
}

function CenterRailPanel(_props: IGridviewPanelProps) {
  const { setDockApi, layoutSnapshot, scheduleLayoutSave } = useShellContext()

  const handleDockReady = useCallback(
    (api: DockviewApi) => {
      setDockApi(api)

      // Try to restore the prior dock layout. fromJSON throws if it references
      // unregistered components, so wrap defensively (handled inside tryRestore).
      const { dock: restored } = tryRestore(null, api, layoutSnapshot)

      if (!restored && !api.getPanel("main")) {
        // First-run / unrestorable: mount the singleton workspace shell.
        api.addPanel({
          id: "main",
          component: "main",
          title: "Workspace",
        })
      } else if (restored && !api.getPanel("main")) {
        // Restored snapshot but the workspace shell wasn't in it (older
        // snapshot or the user closed it). Re-add to keep the chat reachable.
        api.addPanel({
          id: "main",
          component: "main",
          title: "Workspace",
        })
      }

      // Persist on every layout change (debounced inside the saver).
      api.onDidLayoutChange(() => scheduleLayoutSave())
    },
    [setDockApi, layoutSnapshot, scheduleLayoutSave],
  )

  return (
    <div className="relative h-full w-full overflow-hidden flex flex-col min-w-0">
      <DockShell onApiReady={handleDockReady} className="h-full w-full" />
    </div>
  )
}

const GRID_COMPONENTS: Record<string, React.FunctionComponent<IGridviewPanelProps>> = {
  "left-rail": LeftRailPanel,
  "center": CenterRailPanel,
  "right-rail": DetailsRail,
}

// ============================================================================
// Component
// ============================================================================

export function AgentsLayout() {
  // No useHydrateAtoms - desktop doesn't need SSR, atomWithStorage handles persistence
  const isMobile = useIsMobile()

  // Global desktop/fullscreen state - initialized here at root level
  const [isDesktop, setIsDesktop] = useAtom(isDesktopAtom)
  const [isFullscreen, setIsFullscreen] = useAtom(isFullscreenAtom)

  // Initialize isDesktop on mount
  useEffect(() => {
    setIsDesktop(isDesktopApp())
  }, [setIsDesktop])

  // Subscribe to fullscreen changes from Electron
  useEffect(() => {
    if (
      !isDesktop ||
      typeof window === "undefined" ||
      !window.desktopApi?.windowIsFullscreen
    )
      return

    // Get initial fullscreen state
    window.desktopApi.windowIsFullscreen().then(setIsFullscreen)

    // In dev mode, HMR breaks IPC event subscriptions, so we poll instead
    const isDev = import.meta.env.DEV
    if (isDev) {
      const interval = setInterval(() => {
        window.desktopApi?.windowIsFullscreen?.().then(setIsFullscreen)
      }, 300)
      return () => clearInterval(interval)
    }

    // In production, use events (more efficient)
    const unsubscribe = window.desktopApi.onFullscreenChange?.(setIsFullscreen)
    return unsubscribe
  }, [isDesktop, setIsFullscreen])

  // UPDATES-DISABLED: re-enable to restore update checking
  // Check for updates on mount and periodically
  // useUpdateChecker()

  const [sidebarOpen, setSidebarOpen] = useAtom(agentsSidebarOpenAtom)
  const [sidebarWidth, setSidebarWidth] = useAtom(agentsSidebarWidthAtom)
  const detailsOpen = useAtomValue(detailsSidebarOpenAtom)
  const [detailsWidth, setDetailsWidth] = useAtom(detailsSidebarWidthAtom)
  const setSettingsActiveTab = useSetAtom(agentsSettingsDialogActiveTabAtom)
  const setSettingsDialogOpen = useSetAtom(agentsSettingsDialogOpenAtom)
  const desktopView = useAtomValue(desktopViewAtom)
  const setFileSearchDialogOpen = useSetAtom(fileSearchDialogOpenAtom)
  const [selectedChatId, setSelectedChatId] = useAtom(selectedAgentChatIdAtom)
  const [selectedProject, setSelectedProject] = useAtom(selectedProjectAtom)
  const setSelectedDraftId = useSetAtom(selectedDraftIdAtom)
  const setShowNewChatForm = useSetAtom(showNewChatFormAtom)
  const betaKanbanEnabled = useAtomValue(betaKanbanEnabledAtom)
  const setDesktopView = useSetAtom(desktopViewAtom)
  const setAnthropicOnboardingCompleted = useSetAtom(
    anthropicOnboardingCompletedAtom
  )
  const setApiKeyOnboardingCompleted = useSetAtom(apiKeyOnboardingCompletedAtom)
  const setCodexOnboardingCompleted = useSetAtom(codexOnboardingCompletedAtom)
  const setBillingMethod = useSetAtom(billingMethodAtom)
  const claudeLoginModalConfig = useAtomValue(claudeLoginModalConfigAtom)

  // Fetch projects to validate selectedProject exists
  const { data: projects, isLoading: isLoadingProjects } =
    trpc.projects.list.useQuery()

  // Validated project - only valid if exists in DB
  // While loading, trust localStorage value to prevent clearing on app restart
  const validatedProject = useMemo(() => {
    if (!selectedProject) return null
    // While loading, trust localStorage value to prevent flicker and clearing
    if (isLoadingProjects) return selectedProject
    // After loading, validate against DB
    if (!projects) return null
    const exists = projects.some((p) => p.id === selectedProject.id)
    return exists ? selectedProject : null
  }, [selectedProject, projects, isLoadingProjects])

  // Clear invalid project from storage (only after loading completes)
  useEffect(() => {
    if (
      selectedProject &&
      projects &&
      !isLoadingProjects &&
      !validatedProject
    ) {
      setSelectedProject(null)
    }
  }, [
    selectedProject,
    projects,
    isLoadingProjects,
    validatedProject,
    setSelectedProject,
  ])

  // Sync macOS traffic-light visibility with the left sidebar. The native
  // chrome owns the top-left corner; when the sidebar is open it provides the
  // 78px gutter, when closed we hide the lights so the content can flush left.
  // SettingsSidebar manages its own (always hidden) overrides.
  const isSettingsView = desktopView === "settings"
  useEffect(() => {
    if (!isDesktop) return
    if (isSettingsView) return
    if (
      typeof window === "undefined" ||
      !window.desktopApi?.setTrafficLightVisibility
    )
      return

    window.desktopApi.setTrafficLightVisibility(sidebarOpen)
  }, [sidebarOpen, isDesktop, isFullscreen, isSettingsView])

  const setChatId = useAgentSubChatStore((state) => state.setChatId)

  // Desktop user state
  const [desktopUser, setDesktopUser] = useState<{
    id: string
    email: string
    name: string | null
    imageUrl: string | null
    username: string | null
  } | null>(null)

  // Fetch desktop user on mount
  useEffect(() => {
    async function fetchUser() {
      if (window.desktopApi?.getUser) {
        const user = await window.desktopApi.getUser()
        setDesktopUser(user)
      }
    }
    fetchUser()
  }, [])

  // Track if this is the initial load - skip auto-open on first load to respect saved state
  const isInitialLoadRef = useRef(true)

  // Auto-open sidebar when project is selected, close when no project
  // Skip on initial load to preserve user's saved sidebar preference
  useEffect(() => {
    if (!projects) return // Don't change sidebar state while loading

    // On initial load, just mark as loaded and don't change sidebar state
    if (isInitialLoadRef.current) {
      isInitialLoadRef.current = false
      return
    }

    // After initial load, react to project changes
    if (validatedProject) {
      setSidebarOpen(true)
    } else {
      setSidebarOpen(false)
    }
  }, [validatedProject, projects, setSidebarOpen])

  // Worktree setup failures from main process
  useEffect(() => {
    if (typeof window === "undefined") return
    const desktopApi = window.desktopApi as any
    if (!desktopApi?.onWorktreeSetupFailed) return

    const unsubscribe = desktopApi.onWorktreeSetupFailed((payload: { kind: "create-failed" | "setup-failed"; message: string; projectId: string }) => {
      const errorMessage = payload.message.replace(/\s+/g, " ").trim()
      const title =
        payload.kind === "create-failed"
          ? "Worktree creation failed"
          : "Worktree setup failed"

      toast.error(title, {
        description: errorMessage || undefined,
        duration: 10000,
        action: {
          label: "Open settings",
          onClick: () => {
            const projectMatch = projects?.find((project) => project.id === payload.projectId)
            if (projectMatch) {
              setSelectedProject(projectMatch as any)
            }
            setSettingsActiveTab("projects")
            setSettingsDialogOpen(true)
          },
        },
      })
    })

    return unsubscribe
  }, [projects, setSelectedProject, setSettingsActiveTab, setSettingsDialogOpen])

  // Handle sign out
  const handleSignOut = useCallback(async () => {
    // Reset onboarding/provider selection state on logout.
    setSelectedProject(null)
    setSelectedChatId(null)
    setBillingMethod(null)
    setAnthropicOnboardingCompleted(false)
    setApiKeyOnboardingCompleted(false)
    setCodexOnboardingCompleted(false)
    if (window.desktopApi?.logout) {
      await window.desktopApi.logout()
    }
  }, [
    setSelectedProject,
    setSelectedChatId,
    setBillingMethod,
    setAnthropicOnboardingCompleted,
    setApiKeyOnboardingCompleted,
    setCodexOnboardingCompleted,
  ])

  // Clear sub-chat store when no chat is selected
  useEffect(() => {
    if (!selectedChatId) {
      setChatId(null)
    }
  }, [selectedChatId, setChatId])

  // Chat search toggle
  const toggleChatSearch = useSetAtom(toggleSearchAtom)

  // Custom hotkeys config
  const customHotkeysConfig = useAtomValue(customHotkeysAtom)

  // Initialize hotkeys manager
  useAgentsHotkeys({
    setSelectedChatId,
    setSelectedDraftId,
    setShowNewChatForm,
    setDesktopView,
    setSidebarOpen,
    setSettingsActiveTab,
    setFileSearchDialogOpen,
    toggleChatSearch,
    selectedChatId,
    customHotkeysConfig,
    betaKanbanEnabled,
  })

  const handleCloseSidebar = useCallback(() => {
    setSidebarOpen(false)
  }, [setSidebarOpen])

  // ============================================================================
  // Gridview wiring — outer 3-column shell (left rail / center / right rail).
  // Right rail is added in step 5 when DetailsSidebar is lifted out of ChatView.
  // ============================================================================

  const gridApiRef = useRef<GridviewApi | null>(null)
  const { resolvedTheme } = useTheme()
  const dockviewThemeClass =
    resolvedTheme === "dark" ? "dockview-theme-dark" : "dockview-theme-light"

  // Apply the dockview theme class to <html> so the cascade reaches every
  // dockview element regardless of which DOM subtree (or React portal target)
  // it renders into. Putting it on a wrapper div was unreliable: dockview's
  // group/panel containers sometimes sit outside the wrapper depending on how
  // gridview's portals resolve, so the cascade missed them and the chat panel
  // kept inheriting dockview's #1e1e1e default.
  useEffect(() => {
    const html = document.documentElement
    html.classList.remove("dockview-theme-light", "dockview-theme-dark")
    html.classList.add(dockviewThemeClass)
    return () => {
      html.classList.remove("dockview-theme-light", "dockview-theme-dark")
    }
  }, [dockviewThemeClass])

  // Layout persistence — load once at mount, save (debounced) on every change.
  const layoutSnapshot = useMemo(() => loadLayoutSnapshot(), [])
  const layoutSaverRef = useRef(makeDebouncedSaver(300))
  const [dockApi, setDockApi] = useState<DockviewApi | null>(null)

  const scheduleLayoutSave = useCallback(() => {
    layoutSaverRef.current.schedule(gridApiRef.current, dockApi)
  }, [dockApi])

  // Flush any pending save on unmount (e.g. window close).
  useEffect(() => {
    const saver = layoutSaverRef.current
    return () => saver.flush()
  }, [])

  const handleGridReady = useCallback(
    ({ api }: GridviewReadyEvent) => {
      gridApiRef.current = api

      const { shell: restored } = tryRestore(api, null, layoutSnapshot)

      if (!restored) {
        // First-run / unrestorable: build the default 3-cell layout.
        const initialLeftWidth = Math.min(
          Math.max(sidebarWidth ?? SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH),
          SIDEBAR_MAX_WIDTH,
        )
        const initialRightWidth = Math.min(
          Math.max(detailsWidth ?? DETAILS_RAIL_DEFAULT_WIDTH, DETAILS_RAIL_MIN_WIDTH),
          DETAILS_RAIL_MAX_WIDTH,
        )
        api.addPanel({
          id: "left-rail",
          component: "left-rail",
          minimumWidth: SIDEBAR_MIN_WIDTH,
          maximumWidth: SIDEBAR_MAX_WIDTH,
        })
        api.addPanel({
          id: "center",
          component: "center",
          priority: LayoutPriority.High,
          position: { referencePanel: "left-rail", direction: "right" },
        })
        api.addPanel({
          id: "right-rail",
          component: "right-rail",
          minimumWidth: DETAILS_RAIL_MIN_WIDTH,
          maximumWidth: DETAILS_RAIL_MAX_WIDTH,
          position: { referencePanel: "center", direction: "right" },
        })
        const left = api.getPanel("left-rail")
        if (left) {
          left.api.setSize({ width: initialLeftWidth })
          left.api.setVisible(!isMobile && sidebarOpen)
        }
        const right = api.getPanel("right-rail")
        if (right) {
          right.api.setSize({ width: initialRightWidth })
          right.api.setVisible(detailsOpen)
        }
      }

      // Persist width on layout change + schedule a snapshot save.
      api.onDidLayoutChange(() => {
        const left = api.getPanel("left-rail")
        if (left?.api.isVisible) {
          const w = left.api.width
          if (w && w !== sidebarWidth) setSidebarWidth(w)
        }
        const right = api.getPanel("right-rail")
        if (right?.api.isVisible) {
          const w = right.api.width
          if (w && w !== detailsWidth) setDetailsWidth(w)
        }
        scheduleLayoutSave()
      })
    },
    // Intentionally only on mount — subsequent atom changes are pushed via the
    // useEffect below; this callback only runs once when gridview is ready.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [layoutSnapshot, scheduleLayoutSave],
  )

  // Sync sidebar open state with the gridview left panel.
  useEffect(() => {
    const api = gridApiRef.current
    if (!api) return
    const left = api.getPanel("left-rail")
    if (!left) return
    const shouldShow = !isMobile && sidebarOpen
    if (left.api.isVisible !== shouldShow) {
      left.api.setVisible(shouldShow)
    }
  }, [isMobile, sidebarOpen])

  // Sync details rail open state with the gridview right panel.
  useEffect(() => {
    const api = gridApiRef.current
    if (!api) return
    const right = api.getPanel("right-rail")
    if (!right) return
    if (right.api.isVisible !== detailsOpen) {
      right.api.setVisible(detailsOpen)
    }
  }, [detailsOpen])

  // (DockviewApi state is declared earlier so the layout saver can capture it.)

  const shellCtxValue = useMemo<ShellContextValue>(
    () => ({
      desktopUser,
      onSignOut: handleSignOut,
      onToggleSidebar: handleCloseSidebar,
      setDockApi,
      layoutSnapshot,
      scheduleLayoutSave,
    }),
    [desktopUser, handleSignOut, handleCloseSidebar, layoutSnapshot, scheduleLayoutSave],
  )

  const dockHandles = useMemo<DockHandles>(
    () => ({ dock: dockApi, grid: gridApiRef.current }),
    [dockApi],
  )

  return (
    <TooltipProvider delayDuration={300}>
      {/* Global queue processor - handles message queues for all sub-chats */}
      <QueueProcessor />
      <ClaudeLoginModal
        hideCustomModelSettingsLink={
          claudeLoginModalConfig.hideCustomModelSettingsLink
        }
        autoStartAuth={claudeLoginModalConfig.autoStartAuth}
      />
      <CodexLoginModal />
      <DockProvider value={dockHandles}>
        <ChatPanelSync />
        <RenameDispatchHost />
        <ShellProvider value={shellCtxValue}>
          <div className="flex flex-col w-full h-full relative overflow-hidden bg-background select-none">
            {/* Windows-only custom title bar (frameless window with min/max/close).
                On macOS we let the native chrome show traffic lights over the
                content; per-section drag strips provide the rest of the drag area. */}
            <WindowsTitleBar />
            <div className="flex-1 min-h-0">
              <GridviewReact
                orientation={Orientation.HORIZONTAL}
                components={GRID_COMPONENTS}
                onReady={handleGridReady}
                proportionalLayout={false}
                className="h-full w-full"
              />
            </div>
            {/* UPDATES-DISABLED: re-enable to restore update banner */}
            {/* <UpdateBanner /> */}
          </div>
        </ShellProvider>
      </DockProvider>
    </TooltipProvider>
  )
}
