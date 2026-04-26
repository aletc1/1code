import type { IDockviewPanelProps } from "dockview-react"
import { PlaceholderPanel } from "./panels/placeholder-panel"
import { MainPanel } from "./panels/main-panel"
import { PlanPanel } from "./panels/plan-panel"
import { DiffPanel } from "./panels/diff-panel"
import type { PanelKind } from "./atoms"

export type PanelComponent = React.FunctionComponent<IDockviewPanelProps>

export const PANEL_COMPONENTS: Record<PanelKind, PanelComponent> = {
  chat: PlaceholderPanel,
  "chat-new": PlaceholderPanel,
  terminal: PlaceholderPanel,
  file: PlaceholderPanel,
  plan: PlanPanel,
  diff: DiffPanel,
  search: PlaceholderPanel,
  "files-tree": PlaceholderPanel,
}

// Dockview consumes a Record<string, FunctionComponent>. We add the "main"
// singleton workspace shell here — it isn't a regular PanelKind because there's
// only ever one of it.
export const dockviewComponents: Record<string, PanelComponent> = {
  ...PANEL_COMPONENTS,
  main: MainPanel,
}
