import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import type { CompositeMetadata } from '../../internals/composite/list/useCompositeList';
import type { TabsTabActivationDirection, TabsTabMetadata, TabsTabValue } from '../tab/TabsTab.vue';
import type { TabsRootChangeEventDetails, TabsRootOrientation } from './TabsRoot.vue';

/**
 * What a tab or a panel tells the root: its value, and a getter for its `id`. The getter gives
 * `undefined` while the part has no `id`, for example while `KeepAlive` has the part deactivated.
 */
export interface TabsPartRegistration {
  value: () => TabsTabValue;
  id: () => string | undefined;
}

export interface TabsRootContext {
  /**
   * The value of the active tab.
   */
  value: ComputedRef<TabsTabValue>;
  /**
   * Sets a new value. It emits `valueChange` and `update:value` and writes the value of an
   * uncontrolled root.
   */
  onValueChange(value: TabsTabValue, eventDetails: TabsRootChangeEventDetails): void;
  /**
   * The component orientation (layout flow direction).
   */
  orientation: ComputedRef<TabsRootOrientation>;
  /**
   * Gives the element of the tab with the given value.
   */
  getTabElementBySelectedValue(selectedValue: TabsTabValue): HTMLElement | null;
  /**
   * Gives the `id` of the tab that corresponds to the given panel value.
   */
  getTabIdByPanelValue(panelValue: TabsTabValue): string | undefined;
  /**
   * Gives the `id` of the panel that corresponds to the given tab value.
   */
  getTabPanelIdByValue(tabValue: TabsTabValue): string | undefined;
  /**
   * Registers a tab one time, in `setup`. Call it with `undefined` to remove the registration.
   * A server render of a part that comes later then has the `id`.
   */
  registerTab(source: symbol, registration: TabsPartRegistration | undefined): void;
  /**
   * Registers a panel one time, in `setup`. Call it with `undefined` to remove the registration.
   */
  registerPanel(source: symbol, registration: TabsPartRegistration | undefined): void;
  /**
   * The list gives the root its map of tab elements.
   */
  setTabMap(map: ReadonlyMap<Element, CompositeMetadata<TabsTabMetadata>>): void;
  /**
   * The position of the active tab relative to the previously active tab.
   */
  tabActivationDirection: Readonly<Ref<TabsTabActivationDirection>>;
  /**
   * Whether `value` or `defaultValue` chose a tab. It is `false` for `null` and for the implicit
   * default `0`, because a server cannot tell which tab the implicit default names. The list gives
   * it to the composite root as `hasActiveItem`.
   */
  hasChosenTab: ComputedRef<boolean>;
}

export const TabsRootContext: InjectionKey<TabsRootContext> = Symbol();

export function useTabsRootContext(): TabsRootContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(TabsRootContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A part of Tabs must be inside <Tabs.Root>. Without a root the part has no value and no orientation. Put the part inside <Tabs.Root>.',
    );
  }

  return context;
}
