import type { IDockviewPanelProps } from "dockview-react"
import { AgentsContent } from "../../agents/ui/agents-content"

/**
 * "Main" panel — singleton workspace shell that hosts the existing chat
 * experience (sub-chat tabs + ChatView + nested DetailsSidebar). Ships in step
 * 5 as the only panel in the dockview center cell. Step 6 (sub-chat fold-in)
 * will replace this with one `chat` panel per sub-chat.
 */
export function MainPanel(_props: IDockviewPanelProps) {
  return (
    <div className="h-full w-full overflow-hidden">
      <AgentsContent />
    </div>
  )
}
