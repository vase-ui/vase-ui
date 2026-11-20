import TabsIndicator from './TabsIndicator.vue';
import TabsList from './TabsList.vue';
import TabsPanel from './TabsPanel.vue';
import TabsRoot from './TabsRoot.vue';
import TabsTab from './TabsTab.vue';
import type {
  TabsIndicatorProps,
  TabsIndicatorState,
  TabsListProps,
  TabsListState,
  TabsPanelProps,
  TabsPanelState,
  TabsRootChangeEventDetails,
  TabsRootChangeEventReason,
  TabsRootOrientation,
  TabsRootProps,
  TabsRootState,
  TabsTabActivationDirection,
  TabsTabPosition,
  TabsTabProps,
  TabsTabSize,
  TabsTabState,
  TabsTabValue,
} from './types';

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 */
export const Root: typeof TabsRoot = TabsRoot;
export namespace Root {
  export type Props<Value = any> = TabsRootProps<Value>;
  export type State = TabsRootState;
  export type Orientation = TabsRootOrientation;
  export type ChangeEventReason = TabsRootChangeEventReason;
  export type ChangeEventDetails = TabsRootChangeEventDetails;
}

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 */
export const List: typeof TabsList = TabsList;
export namespace List {
  export type Props = TabsListProps;
  export type State = TabsListState;
}

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 */
export const Tab: typeof TabsTab = TabsTab;
export namespace Tab {
  export type Props<Value = any> = TabsTabProps<Value>;
  export type State = TabsTabState;
  export type Value = TabsTabValue;
  export type ActivationDirection = TabsTabActivationDirection;
  export type Position = TabsTabPosition;
  export type Size = TabsTabSize;
}

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 */
export const Panel: typeof TabsPanel = TabsPanel;
export namespace Panel {
  export type Props<Value = any> = TabsPanelProps<Value>;
  export type State = TabsPanelState;
}

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 */
export const Indicator: typeof TabsIndicator = TabsIndicator;
export namespace Indicator {
  export type Props = TabsIndicatorProps;
  export type State = TabsIndicatorState;
}
