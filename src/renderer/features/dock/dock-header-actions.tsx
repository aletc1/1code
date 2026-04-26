import {
  Plus,
  FileText,
  FileDiff,
  Search,
  FolderTree,
  RotateCcw,
  MessageSquare,
  Terminal as TerminalIcon,
} from "lucide-react"
import type { IDockviewHeaderActionsProps } from "dockview-react"
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
import { usePanelActions } from "./use-panel-actions"

/**
 * Group-header actions on the right side of the dockview tab strip — one set
 * per group so users can target a specific group when adding panels. Holds
 * the quick-launch icons (Chat, Terminal) and the [+] dropdown ("the rest":
 * Files Tree, Search, Plan, Changes, Reset Layout). The TopBar is reserved
 * for the macOS traffic-lights and the window drag region only.
 */
export function DockHeaderActions(_props: IDockviewHeaderActionsProps) {
  const actions = usePanelActions()

  return (
    <div className="flex items-center h-full px-0.5 gap-0.5">
      <HeaderIconButton
        tooltip="Show chat"
        ariaLabel="Show chat"
        icon={<MessageSquare style={{ width: 12, height: 12 }} />}
        disabled={!actions.canFocusChat}
        onClick={actions.focusChat}
      />
      <HeaderIconButton
        tooltip="New terminal"
        ariaLabel="New terminal"
        icon={<TerminalIcon style={{ width: 12, height: 12 }} />}
        disabled={!actions.canOpenTerminal}
        onClick={actions.openTerminal}
      />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="Open a panel"
                className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                style={{ width: 22, height: 22 }}
              >
                <Plus style={{ width: 14, height: 14 }} />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Open a panel</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem
            disabled={!actions.canOpenFilesTree}
            onClick={actions.openFilesTree}
          >
            <FolderTree className="h-4 w-4 mr-2" />
            Files Tree
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!actions.canOpenSearch}
            onClick={actions.openSearch}
          >
            <Search className="h-4 w-4 mr-2" />
            Search
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!actions.canOpenPlan}
            onClick={actions.openPlan}
          >
            <FileText className="h-4 w-4 mr-2" />
            Show Plan
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!actions.canOpenDiff}
            onClick={actions.openDiff}
          >
            <FileDiff className="h-4 w-4 mr-2" />
            Show Changes
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={actions.resetLayout}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset layout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

interface HeaderIconButtonProps {
  tooltip: string
  ariaLabel: string
  icon: React.ReactNode
  disabled: boolean
  onClick: () => void
}

function HeaderIconButton({
  tooltip,
  ariaLabel,
  icon,
  disabled,
  onClick,
}: HeaderIconButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={onClick}
          className="inline-flex items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50 disabled:pointer-events-none transition-colors"
          style={{ width: 22, height: 22 }}
        >
          {icon}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
