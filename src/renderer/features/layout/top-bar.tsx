import { MessageSquare, Terminal as TerminalIcon } from "lucide-react"
import { isMacOS, isWindows as isWindowsPlatform } from "../../lib/utils/platform"
import { WindowsTitleBar } from "../../components/windows-title-bar"
import { Button } from "../../components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../components/ui/tooltip"
import { usePanelActions } from "../dock"

/**
 * Unified top bar — owns the window drag region and (on macOS) reserves the
 * 78px traffic-light gutter. Hosts the high-frequency quick-launch buttons
 * (Chat, Terminal). The "rest" of the panel-launch menu lives inside the
 * dockview's right header actions ([+] dropdown), one per group.
 */
export function TopBar() {
  // Windows still uses its custom titlebar with min/max/close controls.
  if (isWindowsPlatform()) {
    return <WindowsTitleBar />
  }

  return (
    <div
      className="h-7 flex-shrink-0 flex items-center bg-background border-b border-border/50 select-none"
      style={{
        // @ts-expect-error - WebKit-specific property for Electron window dragging
        WebkitAppRegion: "drag",
      }}
      data-app-top-bar
    >
      {/* macOS traffic-light gutter (titleBarStyle: hiddenInset). 78px reserves
          space for the three native circles (~7,6 origin · 14px each · 8px
          gaps). Bar height (h-7 = 28px) + h-6 buttons (24px) puts the button
          centerline at y=14, matching the traffic-light center at y≈13. */}
      {isMacOS() ? <div className="w-[78px] shrink-0 h-full" /> : null}

      {/* Quick-launch zone — vertically centered icon buttons. */}
      <div
        className="flex items-center h-full gap-0.5 px-1"
        style={{
          // @ts-expect-error - WebKit-specific
          WebkitAppRegion: "no-drag",
        }}
      >
        <QuickLaunchChatButton />
        <QuickLaunchTerminalButton />
      </div>

      {/* Remaining width is drag area. */}
      <div className="flex-1 h-full" />
    </div>
  )
}

function QuickLaunchChatButton() {
  const actions = usePanelActions()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="Show chat"
          disabled={!actions.canFocusChat}
          onClick={actions.focusChat}
        >
          <MessageSquare className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Show chat</TooltipContent>
    </Tooltip>
  )
}

function QuickLaunchTerminalButton() {
  const actions = usePanelActions()
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          aria-label="New terminal"
          disabled={!actions.canOpenTerminal}
          onClick={actions.openTerminal}
        >
          <TerminalIcon className="h-3 w-3" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">New terminal</TooltipContent>
    </Tooltip>
  )
}
