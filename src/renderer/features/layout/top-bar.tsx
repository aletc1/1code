import { isMacOS, isWindows as isWindowsPlatform } from "../../lib/utils/platform"
import { WindowsTitleBar } from "../../components/windows-title-bar"
import { PlusMenu } from "./plus-menu"

/**
 * Unified top bar — owns the window drag region and (on macOS) reserves the
 * 78px traffic-light gutter. Replaces the absolute-positioned 32px strip that
 * lived inside the content area, plus the platform-conditional WindowsTitleBar.
 *
 * Future steps mount the workspace selector, [+] menu, quick-launch buttons,
 * and Details toggle inside the no-drag region in the middle.
 */
export function TopBar() {
  // Windows still uses its custom titlebar with min/max/close controls.
  if (isWindowsPlatform()) {
    return <WindowsTitleBar />
  }

  return (
    <div
      className="h-10 flex-shrink-0 flex items-center bg-background border-b border-border/50 select-none"
      style={{
        // @ts-expect-error - WebKit-specific property for Electron window dragging
        WebkitAppRegion: "drag",
      }}
      data-app-top-bar
    >
      {/* macOS traffic-light gutter (titleBarStyle: hiddenInset). Reserves space
          for the native window controls on the left. */}
      {isMacOS() ? <div className="w-[78px] shrink-0 h-full" /> : null}

      {/* Quick-launch zone — interactive controls live in a no-drag wrapper. */}
      <div
        className="flex items-center h-full px-1 gap-0.5"
        style={{
          // @ts-expect-error - WebKit-specific
          WebkitAppRegion: "no-drag",
        }}
      >
        <PlusMenu />
      </div>

      {/* The remaining width is drag area. */}
      <div className="flex-1 h-full" />
    </div>
  )
}
