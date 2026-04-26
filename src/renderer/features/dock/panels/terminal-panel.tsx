import type { IDockviewPanelProps } from "dockview-react"
import { TerminalSection } from "../../details-sidebar/sections/terminal-section"
import type { TerminalPanelEntity } from "../atoms"

/**
 * TerminalPanel — full-pane variant of the Terminal widget. Hosts the same
 * TerminalSection (with its internal tab strip for multiple terminals per
 * chat). Backend PTY sessions persist via the existing serialize/detach
 * lifecycle in terminal.tsx, so promoting from widget to panel — and dragging
 * the panel between groups — keeps `htop` running.
 */
export function TerminalPanel({ params }: IDockviewPanelProps<TerminalPanelEntity>) {
  return (
    <div className="h-full w-full overflow-hidden">
      <TerminalSection
        chatId={params.chatId}
        cwd={params.cwd}
        workspaceId={params.workspaceId}
        isExpanded
      />
    </div>
  )
}
