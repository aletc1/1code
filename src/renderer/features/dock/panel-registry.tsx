import type { IDockviewPanelProps } from "dockview-react"
import { PlaceholderPanel } from "./panels/placeholder-panel"
import type { PanelKind } from "./atoms"

export type PanelComponent = React.FunctionComponent<IDockviewPanelProps>

export const PANEL_COMPONENTS: Record<PanelKind, PanelComponent> = {
  chat: PlaceholderPanel,
  "chat-new": PlaceholderPanel,
  terminal: PlaceholderPanel,
  file: PlaceholderPanel,
  plan: PlaceholderPanel,
  diff: PlaceholderPanel,
  search: PlaceholderPanel,
  "files-tree": PlaceholderPanel,
}

// Dockview consumes a Record<string, FunctionComponent>, not our typed PanelKind map.
export const dockviewComponents: Record<string, PanelComponent> = PANEL_COMPONENTS
