import { useEffect } from "react"
import { usePanelActions } from "./use-panel-actions"

/**
 * Bridges the global agent action system to per-workspace dock actions.
 *
 * The action handlers in [agents-actions.ts] for `create-new-subchat` /
 * `new-terminal` / `open-search` can't call `usePanelActions()` directly —
 * `usePanelActions` reads `useDockApi()` which requires being inside the
 * `DockProvider`. The action handlers (and the hotkey manager that
 * dispatches them) live above the provider in the tree.
 *
 * So those handlers dispatch a `CustomEvent` instead, and this host
 * (mounted *inside* `DockProvider`) listens for the events and calls the
 * matching panel action with the live, currently-active dockApi.
 *
 * Same indirection pattern that `open-in-editor` / `open-file-in-editor`
 * use — see [info-section.tsx] for the receiving end of those events.
 */
export function DockHotkeysHost() {
  const actions = usePanelActions()

  useEffect(() => {
    const handleNewSubChat = () => {
      if (!actions.canNewSubChat) return
      actions.newSubChat()
    }
    const handleNewTerminal = () => {
      if (!actions.canOpenTerminal) return
      actions.openTerminal()
    }
    const handleOpenSearch = () => {
      if (!actions.canOpenSearch) return
      actions.openSearch()
    }

    window.addEventListener("dock:new-subchat", handleNewSubChat)
    window.addEventListener("dock:new-terminal", handleNewTerminal)
    window.addEventListener("dock:open-search", handleOpenSearch)

    return () => {
      window.removeEventListener("dock:new-subchat", handleNewSubChat)
      window.removeEventListener("dock:new-terminal", handleNewTerminal)
      window.removeEventListener("dock:open-search", handleOpenSearch)
    }
  }, [actions])

  return null
}
