import type { DockviewApi, GridviewApi } from "dockview-react"

export interface AgentsLayoutSnapshot {
  version: 2
  /** Result of gridApi.toJSON() — the outer 3-column shell. */
  shell: unknown | null
  /** Result of dockApi.toJSON() — the center-cell panel arrangement. */
  dock: unknown | null
}

// v1 → v2: added the right-rail gridview cell (DetailsRail). Old snapshots
// only have left + center cells, so loading them would miss the new rail.
// Bumping the version invalidates v1 snapshots and falls back to the new
// 3-cell defaults on first launch after the upgrade.
const SCHEMA_VERSION = 2

/**
 * Compute the storage key for the layout snapshot. Today this is a global
 * key. Future: take a `{ workspaceId }` argument and return per-project keys
 * (with a one-shot migration that copies the global value into each project
 * the first time it's opened).
 */
export function layoutStorageKey(): string {
  return "agents:layout:global"
}

export function loadLayoutSnapshot(): AgentsLayoutSnapshot | null {
  try {
    const raw = localStorage.getItem(layoutStorageKey())
    if (!raw) return null
    const parsed = JSON.parse(raw) as AgentsLayoutSnapshot
    if (parsed?.version !== SCHEMA_VERSION) return null
    return parsed
  } catch {
    return null
  }
}

export function saveLayoutSnapshot(snapshot: AgentsLayoutSnapshot): void {
  try {
    localStorage.setItem(layoutStorageKey(), JSON.stringify(snapshot))
  } catch (err) {
    // Quota or other storage error — drop silently; the layout will rebuild
    // from defaults on next reload.
    console.warn("[layout] Failed to persist layout snapshot:", err)
  }
}

/**
 * Capture the current layout into a snapshot. Either api may be null.
 */
export function captureSnapshot(
  grid: GridviewApi | null,
  dock: DockviewApi | null,
): AgentsLayoutSnapshot {
  return {
    version: SCHEMA_VERSION,
    shell: grid ? grid.toJSON() : null,
    dock: dock ? dock.toJSON() : null,
  }
}

/**
 * Try to restore a previously-saved layout. Failures are swallowed and the
 * caller should fall back to the imperative `addPanel` defaults — this keeps
 * the boot path resilient if dockview's serialization format changes.
 */
export function tryRestore(
  grid: GridviewApi | null,
  dock: DockviewApi | null,
  snapshot: AgentsLayoutSnapshot | null,
): { shell: boolean; dock: boolean } {
  let restoredShell = false
  let restoredDock = false

  if (snapshot?.shell && grid) {
    try {
      // dockview's fromJSON throws if the JSON references components that
      // aren't registered. Wrap defensively.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      grid.fromJSON(snapshot.shell as any)
      restoredShell = true
    } catch (err) {
      console.warn("[layout] Failed to restore gridview layout:", err)
    }
  }

  if (snapshot?.dock && dock) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dock.fromJSON(snapshot.dock as any)
      restoredDock = true
    } catch (err) {
      console.warn("[layout] Failed to restore dockview layout:", err)
    }
  }

  return { shell: restoredShell, dock: restoredDock }
}

/**
 * Returns a debounced layout-saver. The returned function captures the
 * current state of both apis on every call, but writes to localStorage only
 * after `delayMs` ms of quiet — debouncing all the noisy onDidLayoutChange
 * events that fire while the user is dragging a sash.
 */
export function makeDebouncedSaver(delayMs = 300): {
  schedule: (grid: GridviewApi | null, dock: DockviewApi | null) => void
  flush: () => void
  cancel: () => void
} {
  let timer: ReturnType<typeof setTimeout> | null = null
  let pendingGrid: GridviewApi | null = null
  let pendingDock: DockviewApi | null = null

  const flush = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
    saveLayoutSnapshot(captureSnapshot(pendingGrid, pendingDock))
  }

  const cancel = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const schedule = (grid: GridviewApi | null, dock: DockviewApi | null) => {
    pendingGrid = grid
    pendingDock = dock
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, delayMs)
  }

  return { schedule, flush, cancel }
}
