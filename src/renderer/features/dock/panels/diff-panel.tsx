import { useCallback, useMemo, useRef, useState } from "react"
import type { IDockviewPanelProps } from "dockview-react"
import { useAtomValue } from "jotai"
import { ChangesPanel } from "../../changes/changes-panel"
import {
  AgentDiffView,
  type AgentDiffViewRef,
} from "../../agents/ui/agent-diff-view"
import {
  workspaceDiffCacheAtomFamily,
  agentsChangesPanelWidthAtom,
  diffActiveTabAtom,
  selectedCommitAtom,
} from "../../agents/atoms"
import { trpc } from "../../../lib/trpc"
import type {
  ChangeCategory,
  ChangedFile,
} from "../../../../shared/changes-types"
import type { DiffPanelEntity } from "../atoms"

/**
 * DiffPanel — full-pane Changes view, mounted as a dockview tab.
 *
 * This is the rich view (file list on the left + line-by-line diff on
 * the right) — equivalent to what the Changes-widget "Open in dialog"
 * action used to render in a center-peek dialog. The dockview tab
 * provides the chrome (title + close), so the panel body skips
 * DiffSidebarHeader and just composes ChangesPanel + AgentDiffView
 * directly.
 *
 * Self-sources its data instead of taking props from active-chat:
 * - `worktreePath` / `sandboxId` / `repository` from `trpc.chats.get`.
 * - `diffStats` / `parsedFileDiffs` / `prefetchedFileContents` from
 *   `workspaceDiffCacheAtomFamily`, populated by ChatView's diff fetcher
 *   (which keeps running while ChatView is mounted in the matching
 *   WorkspaceDockShell).
 * - File / commit / tab selection are component-local state.
 *
 * Action callbacks (commit, create PR, discard, review) are intentionally
 * left as no-ops or thin toasts — those flows have their own UI surfaces
 * in the chat header and chat input, and reproducing them here would mean
 * duplicating a couple hundred lines of mutation glue. The user can
 * commit/PR from the chat side; this panel is for *viewing* changes.
 */
export function DiffPanel({ params }: IDockviewPanelProps<DiffPanelEntity>) {
  const { chatId } = params
  const cache = useAtomValue(workspaceDiffCacheAtomFamily(chatId))
  const changesPanelWidth = useAtomValue(agentsChangesPanelWidthAtom)
  const activeTab = useAtomValue(diffActiveTabAtom)
  const selectedCommit = useAtomValue(selectedCommitAtom)

  const { data: chat } = trpc.chats.get.useQuery(
    { id: chatId },
    { enabled: !!chatId, staleTime: 5_000 },
  )
  const worktreePath = chat?.worktreePath ?? null
  const sandboxId = chat?.sandboxId ?? null
  const repository = chat?.repository ?? null

  const { data: agentChat } = trpc.agents.getAgentChat.useQuery(
    { chatId } as { chatId: string },
    { enabled: !!chatId },
  )

  const subChatsForFilter = useMemo(() => {
    const subs = (agentChat as any)?.subChats ?? []
    return subs.map((sc: { id: string; name?: string | null }) => ({
      id: sc.id,
      name: sc.name ?? "Conversation",
    }))
  }, [agentChat])

  const [selectedFilePath, setSelectedFilePath] = useState<string | null>(null)
  const handleFileSelect = useCallback(
    (file: ChangedFile, _category: ChangeCategory) => {
      setSelectedFilePath(file.path)
    },
    [],
  )

  // Pick a sensible default file to highlight on first paint so the diff
  // view doesn't try to render every file at once.
  const initialSelectedFile = useMemo(() => {
    if (selectedFilePath) return selectedFilePath
    const first = cache.parsedFileDiffs?.[0]
    if (!first) return null
    const candidate =
      first.newPath !== "/dev/null" ? first.newPath : first.oldPath
    return candidate && candidate !== "/dev/null" ? candidate : null
  }, [selectedFilePath, cache.parsedFileDiffs])

  const diffViewRef = useRef<AgentDiffViewRef | null>(null)

  if (!worktreePath || !chatId) {
    return (
      <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
        No worktree available
      </div>
    )
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-background">
      {/* Left: file list / commits */}
      <div
        className="h-full flex-shrink-0 border-r border-border/50"
        style={{ width: changesPanelWidth, borderRightWidth: "0.5px" }}
      >
        <ChangesPanel
          worktreePath={worktreePath}
          activeTab={activeTab}
          selectedFilePath={selectedFilePath}
          onFileSelect={handleFileSelect}
          onFileOpenPinned={() => {}}
          subChats={subChatsForFilter}
          chatId={chatId}
          selectedCommitHash={selectedCommit?.hash}
        />
      </div>
      {/* Right: line-by-line diff for the selected file */}
      <div className="flex-1 min-w-0 h-full overflow-hidden">
        <AgentDiffView
          ref={diffViewRef}
          chatId={chatId}
          sandboxId={sandboxId ?? ""}
          worktreePath={worktreePath}
          repository={repository ?? undefined}
          initialDiff={cache.diffContent}
          initialParsedFiles={cache.parsedFileDiffs}
          prefetchedFileContents={cache.prefetchedFileContents ?? {}}
          showFooter={false}
          initialSelectedFile={initialSelectedFile}
        />
      </div>
    </div>
  )
}
