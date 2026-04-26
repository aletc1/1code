import { isMacOS, isWindows as isWindowsPlatform } from "../../lib/utils/platform"
import { WindowsTitleBar } from "../../components/windows-title-bar"

/**
 * Unified top bar — owns the window drag region and (on macOS) reserves the
 * 78px traffic-light gutter. Intentionally minimal: only the OS chrome
 * (traffic-lights via the gutter, drag region across the rest). Quick-launch
 * actions (Chat, Terminal, [+]) live inside the dockview's group header
 * actions so the title bar stays out of the way.
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

      {/* Rest is drag area. */}
      <div className="flex-1 h-full" />
    </div>
  )
}
