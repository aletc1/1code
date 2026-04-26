import {
  Plus,
  FileText,
  FileDiff,
  Search,
  FolderTree,
  RotateCcw,
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
 * Renders the [+] dropdown in the dockview's right-side header actions slot —
 * one per group, so users can target a specific group when adding panels.
 *
 * The TopBar shows the most-used quick-launch icons (Chat, Terminal); this
 * menu is "the rest" — Files Tree, Search, Plan, Changes, Reset Layout.
 */
export function DockHeaderActions(_props: IDockviewHeaderActionsProps) {
  const actions = usePanelActions()

  return (
    <div className="flex items-center h-full px-1">
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                aria-label="Open a panel"
              >
                <Plus className="h-3.5 w-3.5" />
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
