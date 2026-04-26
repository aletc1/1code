import { DockviewReact, type DockviewReadyEvent, type DockviewApi } from "dockview-react"
import { useCallback, useState } from "react"
import { useSetAtom } from "jotai"
import { dockviewComponents } from "./panel-registry"
import { dockReadyAtom, widgetPanelMapAtom } from "./atoms"
import { DockHeaderActions } from "./dock-header-actions"

export interface DockShellProps {
  onApiReady?: (api: DockviewApi) => void
  className?: string
}

/**
 * Mounts DockviewReact and exposes its api via onApiReady.
 * The outer AppShell wires this api into DockProvider context.
 */
export function DockShell({ onApiReady, className }: DockShellProps) {
  const [, setApi] = useState<DockviewApi | null>(null)
  const setReady = useSetAtom(dockReadyAtom)
  const setMap = useSetAtom(widgetPanelMapAtom)

  const handleReady = useCallback(
    (event: DockviewReadyEvent) => {
      setApi(event.api)
      setReady(true)
      onApiReady?.(event.api)

      // When a panel is removed for any reason, clear it from the widget mutex map
      // so the matching summary widget reappears in the Details rail.
      const sub = event.api.onDidRemovePanel((panel) => {
        setMap((m) => {
          let changed = false
          const next = { ...m }
          for (const key of Object.keys(next)) {
            if (next[key] === panel.id) {
              next[key] = null
              changed = true
            }
          }
          return changed ? next : m
        })
      })

      // We don't expose a teardown here because dockview itself owns the lifecycle.
      // The subscription lives as long as the api does.
      void sub
    },
    [onApiReady, setReady, setMap],
  )

  return (
    <DockviewReact
      className={className}
      components={dockviewComponents}
      onReady={handleReady}
      rightHeaderActionsComponent={DockHeaderActions}
      singleTabMode="fullwidth"
    />
  )
}
