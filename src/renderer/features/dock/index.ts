export {
  DockProvider,
  useDockApi,
  useGridApi,
  useDockHandles,
  type DockHandles,
} from "./dock-context"
export { DockShell } from "./dock-shell"
export {
  panelIdFor,
  panelTitleFor,
  widgetMutexKey,
  widgetPanelMapAtom,
  pinnedPanelIdsAtom,
  dockReadyAtom,
  type PanelEntity,
  type PanelKind,
} from "./atoms"
export { addOrFocus, type AddOrFocusOptions } from "./add-or-focus"
export { PANEL_COMPONENTS, dockviewComponents } from "./panel-registry"
export { useWidgetPanel, type WidgetPanelHandle } from "./use-widget-panel"
export {
  loadLayoutSnapshot,
  saveLayoutSnapshot,
  captureSnapshot,
  tryRestore,
  makeDebouncedSaver,
  layoutStorageKey,
  type AgentsLayoutSnapshot,
} from "./persistence"
