import { MessageSquare, Terminal as TerminalIcon } from "lucide-react"
import { isMacOS, isWindows as isWindowsPlatform } from "../../lib/utils/platform"
import { WindowsTitleBar } from "../../components/windows-title-bar"
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
 *
 * Sizing is deliberately hand-rolled (raw <button> + inline width/height)
 * rather than the shadcn Button component: cva + tailwind-merge swallowed
 * size overrides under `size="icon"` (h-7 w-7) and the buttons came out 4 px
 * taller than the macOS traffic-lights, leaving them visibly mis-aligned.
 * Hard-coded 22 px buttons in a 28 px bar place the centerline at y=14, which
 * matches the OS-positioned traffic-light center at y≈13.
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
      {/* macOS traffic-light gutter (titleBarStyle: hiddenInset). */}
      {isMacOS() ? <div className="w-[78px] shrink-0 h-full" /> : null}

      {/* Quick-launch zone — buttons are positioned manually for pixel-perfect
          alignment with the OS traffic-lights. */}
      <div
        className="flex items-center h-full gap-0.5 pl-1"
        style={{
          // @ts-expect-error - WebKit-specific
          WebkitAppRegion: "no-drag",
        }}
      >
        <QuickLaunchButtons />
      </div>

      {/* Remaining width is drag area. */}
      <div className="flex-1 h-full" />
    </div>
  )
}

function QuickLaunchButtons() {
  const actions = usePanelActions()
  return (
    <>
      <QuickLaunchButton
        tooltip="Show chat"
        ariaLabel="Show chat"
        icon={<MessageSquare style={{ width: 12, height: 12 }} />}
        disabled={!actions.canFocusChat}
        onClick={actions.focusChat}
      />
      <QuickLaunchButton
        tooltip="New terminal"
        ariaLabel="New terminal"
        icon={<TerminalIcon style={{ width: 12, height: 12 }} />}
        disabled={!actions.canOpenTerminal}
        onClick={actions.openTerminal}
      />
    </>
  )
}

interface QuickLaunchButtonProps {
  tooltip: string
  ariaLabel: string
  icon: React.ReactNode
  disabled: boolean
  onClick: () => void
}

function QuickLaunchButton({
  tooltip,
  ariaLabel,
  icon,
  disabled,
  onClick,
}: QuickLaunchButtonProps) {
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
