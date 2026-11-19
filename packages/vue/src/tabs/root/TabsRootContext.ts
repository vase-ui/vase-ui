import { inject } from 'vue';
import type { ComputedRef, InjectionKey } from 'vue';
import type {
  CompositeListContextValue,
  CompositeMetadata,
} from '../../internals/composite/list/useCompositeList';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { TabsTabMetadata, TabsTabValue } from '../tab/TabsTab.vue';
import type { TabsRootChangeEventDetails, TabsRootState } from './TabsRoot.vue';
import * as TabsRootDataAttributes from './TabsRootDataAttributes';

export const tabsStateAttributesMapping: StateAttributesMapping<TabsRootState> = {
  tabActivationDirection: (dir) => ({ [TabsRootDataAttributes.activationDirection]: dir }),
};

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
   * Sets a new value. It emits `valueChange` and `update:modelValue` and writes the value of an
   * uncontrolled root.
   */
  onValueChange(value: TabsTabValue, eventDetails: TabsRootChangeEventDetails): void;
  state: ComputedRef<TabsRootState>;
  activeTabElement: ComputedRef<HTMLElement | null>;
  /**
   * Gives the `id` of the tab that corresponds to the given panel value.
   */
  getTabIdByPanelValue(panelValue: TabsTabValue): string | undefined;
  /**
   * Gives the `id` of the panel that corresponds to the given tab value.
   */
  getTabPanelIdByValue(tabValue: TabsTabValue): string | undefined;
  /**
   * Registers a tab one time, in `setup`, so that the server HTML of a panel has the `id`.
   * Call it with `undefined` to remove the registration.
   */
  registerTab(source: symbol, registration: TabsPartRegistration | undefined): void;
  /**
   * Registers a panel one time, in `setup`, so that the server HTML of a tab has the `id`.
   * Call it with `undefined` to remove the registration.
   */
  registerPanel(source: symbol, registration: TabsPartRegistration | undefined): void;
  /**
   * The list gives the root its map of tab elements.
   */
  setTabMap(map: ReadonlyMap<Element, CompositeMetadata<TabsTabMetadata>>): void;
  /**
   * Whether `modelValue` or `defaultValue` chose a tab. It is `false` for `null` and for the implicit
   * default `0`, because a server cannot tell which tab the implicit default names. The list gives
   * it to the composite root as `hasActiveItem`.
   */
  hasChosenTab: ComputedRef<boolean>;
  /**
   * The list of the panels. The panels register with it through this context. The root does not
   * provide the list, so an item of a composite around the root joins that composite.
   */
  panelList: CompositeListContextValue<unknown>;
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
