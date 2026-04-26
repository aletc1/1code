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
export { usePanelActions, type PanelActions } from "./use-panel-actions"
export { DockHeaderActions } from "./dock-header-actions"
export { ChatPanelSync } from "./chat-panel-sync"
export { RenamableTab, RenameDispatchHost } from "./renamable-tab"
export { ChatTabArchiveHost } from "./chat-tab-archive"
export { TerminalTabCloseHost } from "./terminal-tab-close"
export {
  loadLayoutSnapshot,
  saveLayoutSnapshot,
  captureSnapshot,
  tryRestore,
  makeDebouncedSaver,
  layoutStorageKey,
  type AgentsLayoutSnapshot,
} from "./persistence"
