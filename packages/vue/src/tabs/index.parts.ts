import TabsIndicator from './indicator/TabsIndicator.vue';
import type { TabsIndicatorProps, TabsIndicatorState } from './indicator/TabsIndicator.vue';
import TabsList from './list/TabsList.vue';
import type { TabsListProps, TabsListState } from './list/TabsList.vue';
import TabsPanel from './panel/TabsPanel.vue';
import type { TabsPanelMetadata, TabsPanelProps, TabsPanelState } from './panel/TabsPanel.vue';
import TabsRoot from './root/TabsRoot.vue';
import type {
  TabsRootChangeEventDetails,
  TabsRootChangeEventReason,
  TabsRootOrientation,
  TabsRootProps,
  TabsRootState,
} from './root/TabsRoot.vue';
import TabsTab from './tab/TabsTab.vue';
import type {
  TabsTabActivationDirection,
  TabsTabMetadata,
  TabsTabPosition,
  TabsTabProps,
  TabsTabSize,
  TabsTabState,
  TabsTabValue,
} from './tab/TabsTab.vue';

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 */
export const Root: typeof TabsRoot = TabsRoot;
export namespace Root {
  export type State = TabsRootState;
  export type Props = TabsRootProps;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 */
export const Tab: typeof TabsTab = TabsTab;
export namespace Tab {
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
  export type Metadata = TabsTabMetadata;
  export type State = TabsTabState;
  export type Props = TabsTabProps;
}

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 */
export const Indicator: typeof TabsIndicator = TabsIndicator;
export namespace Indicator {
  export type State = TabsIndicatorState;
  export type Props = TabsIndicatorProps;
}

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 */
export const Panel: typeof TabsPanel = TabsPanel;
export namespace Panel {
  export type Metadata = TabsPanelMetadata;
  export type State = TabsPanelState;
  export type Props = TabsPanelProps;
}

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 */
export const List: typeof TabsList = TabsList;
export namespace List {
  export type State = TabsListState;
  export type Props = TabsListProps;
}
