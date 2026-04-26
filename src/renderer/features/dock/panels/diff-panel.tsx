import type { IDockviewPanelProps } from "dockview-react"
import { useAtomValue } from "jotai"
import { workspaceDiffCacheAtomFamily } from "../../agents/atoms"
import { DiffSection } from "../../details-sidebar/sections/diff-section"
import type { DiffPanelEntity } from "../atoms"

/**
 * DiffPanel — full-pane variant of the Changes widget. Reads diff data from
 * the per-chat workspaceDiffCacheAtomFamily, which is populated by ChatView's
 * diff fetcher. setIsDiffSidebarOpen is a no-op here (the panel itself IS the
 * expanded view; clicks shouldn't try to re-open a legacy sidebar).
 */
export function DiffPanel({ params }: IDockviewPanelProps<DiffPanelEntity>) {
  const cache = useAtomValue(workspaceDiffCacheAtomFamily(params.chatId))
  return (
    <div className="h-full w-full overflow-y-auto">
      <DiffSection
        chatId={params.chatId}
        isDiffSidebarOpen={true}
        setIsDiffSidebarOpen={() => {}}
        diffStats={cache.diffStats}
        parsedFileDiffs={cache.parsedFileDiffs}
        isExpanded
      />
    </div>
  )
}
