import TabsIndicator from './TabsIndicator.vue';
import TabsList from './TabsList.vue';
import TabsPanel from './TabsPanel.vue';
import TabsRoot from './TabsRoot.vue';
import TabsTab from './TabsTab.vue';

/**
 * Groups the tabs and the corresponding panels.
 * Renders a `<div>` element.
 */
export const Root: typeof TabsRoot = TabsRoot;

/**
 * Groups the individual tab buttons.
 * Renders a `<div>` element.
 */
export const List: typeof TabsList = TabsList;

/**
 * An individual interactive tab button that toggles the corresponding panel.
 * Renders a `<button>` element.
 */
export const Tab: typeof TabsTab = TabsTab;

/**
 * A panel displayed when the corresponding tab is active.
 * Renders a `<div>` element.
 */
export const Panel: typeof TabsPanel = TabsPanel;

/**
 * A visual indicator that can be styled to match the position of the currently active tab.
 * Renders a `<span>` element.
 */
export const Indicator: typeof TabsIndicator = TabsIndicator;
