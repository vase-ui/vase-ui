import TabsList from './list/TabsList.vue';
import type { TabsListProps, TabsListState } from './list/TabsList.vue';
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
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 */
export const List: typeof TabsList = TabsList;
export namespace List {
  export type State = TabsListState;
  export type Props = TabsListProps;
}
