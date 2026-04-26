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
import { usePanelActions } from "./use-panel-actions"

/**
 * Group-header actions on the right side of the dockview tab strip — one set
 * per group so users can target a specific group when adding panels. Holds
 * the quick-launch icons (Chat, Terminal) and the [+] dropdown ("the rest":
 * Files Tree, Search, Plan, Changes, Reset Layout).
 *
 * Icon buttons match the existing app-wide pattern (h-6 w-6, h-4 w-4 icon)
 * used by the chats sidebar so all top-row buttons line up.
 */
export function DockHeaderActions(_props: IDockviewHeaderActionsProps) {
  const actions = usePanelActions()

  return (
    <div
      className="flex items-center h-full px-1 gap-0.5"
      style={{
        // @ts-expect-error - WebKit-specific property: keep buttons clickable
        WebkitAppRegion: "no-drag",
      }}
    >
      <HeaderIconButton
        tooltip="Show chat"
        ariaLabel="Show chat"
        icon={<MessageSquare className="h-4 w-4" />}
        disabled={!actions.canFocusChat}
        onClick={actions.focusChat}
      />
      <HeaderIconButton
        tooltip="New terminal"
        ariaLabel="New terminal"
        icon={<TerminalIcon className="h-4 w-4" />}
        disabled={!actions.canOpenTerminal}
        onClick={actions.openTerminal}
      />
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Open a panel"
                className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md text-muted-foreground hover:text-foreground"
              >
                <Plus className="h-4 w-4" />
              </Button>
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
        <Button
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          disabled={disabled}
          onClick={onClick}
          className="h-6 w-6 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:pointer-events-none"
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{tooltip}</TooltipContent>
    </Tooltip>
  )
}
