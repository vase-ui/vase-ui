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
 * @selector `[data-orientation]` The orientation of the tabs: `horizontal` or `vertical`.
 * @selector `[data-activation-direction]` The side of the new active tab from the old one: `left`, `right`, `up`, `down` or `none`.
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
 * Groups the individual tab buttons. At the mount, a list that scrolls shows its active tab.
 * Renders a `<div>` element with the role `tablist`.
 * @selector `[aria-orientation="vertical"]` The tabs are vertical.
 * @selector `[data-activation-direction]` The side of the new active tab from the old one: `left`, `right`, `up`, `down` or `none`.
 */
export const List: typeof TabsList = TabsList;
export namespace List {
  export type Props = TabsListProps;
  export type State = TabsListState;
}

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element with the role `tab`.
 * @selector `[aria-selected="true"]` The tab is active.
 * @selector `[aria-disabled="true"]` The tab is disabled.
 * @selector `[data-orientation]` The orientation of the tabs: `horizontal` or `vertical`.
 * @selector `[data-activation-direction]` The side of the new active tab from the old one: `left`, `right`, `up`, `down` or `none`.
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
 * Renders a `<div>` element with the role `tabpanel`.
 * @selector `[hidden]` The panel is closed, and `keepMounted` keeps it in the DOM.
 * @selector `[data-orientation]` The orientation of the tabs: `horizontal` or `vertical`.
 * @selector `[data-activation-direction]` The side of the new active tab from the old one: `left`, `right`, `up`, `down` or `none`.
 */
export const Panel: typeof TabsPanel = TabsPanel;
export namespace Panel {
  export type Props<Value = any> = TabsPanelProps<Value>;
  export type State = TabsPanelState;
}

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 * @selector `[data-orientation]` The orientation of the tabs: `horizontal` or `vertical`.
 * @selector `[data-activation-direction]` The side of the new active tab from the old one: `left`, `right`, `up`, `down` or `none`.
 * @cssVariable `--active-tab-left` The distance from the left edge of the list to the active tab, in pixels.
 * @cssVariable `--active-tab-right` The distance from the right edge of the list to the active tab, in pixels.
 * @cssVariable `--active-tab-top` The distance from the top edge of the list to the active tab, in pixels.
 * @cssVariable `--active-tab-bottom` The distance from the bottom edge of the list to the active tab, in pixels.
 * @cssVariable `--active-tab-width` The width of the active tab, in pixels.
 * @cssVariable `--active-tab-height` The height of the active tab, in pixels.
 */
export const Indicator: typeof TabsIndicator = TabsIndicator;
export namespace Indicator {
  export type Props = TabsIndicatorProps;
  export type State = TabsIndicatorState;
}
