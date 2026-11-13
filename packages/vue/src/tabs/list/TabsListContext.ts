import { inject } from 'vue';
import type { ComputedRef, InjectionKey, ShallowRef } from 'vue';

export interface TabsListContext {
  activateOnFocus: ComputedRef<boolean>;
  /**
   * Registers a listener that the list calls when its size or the size of a tab changes.
   * Returns the function that removes the listener.
   */
  registerIndicatorUpdateListener(listener: () => void): () => void;
  /**
   * Makes the list observe the size of a tab element. Returns the function that stops it.
   */
  registerTabResizeObserverElement(element: HTMLElement): () => void;
  tabsListElement: ShallowRef<HTMLElement | null>;
}

export const TabsListContext: InjectionKey<TabsListContext> = Symbol();

export function useTabsListContext(): TabsListContext {
  // With one argument, Vue shows a warning when there is no provider. The error below says more.
  const context = inject(TabsListContext, undefined);
  if (context === undefined) {
    throw new Error(
      'Vase UI: A tab or an indicator of Tabs must be inside <Tabs.List>. Without a list the part has no list element to read and no keyboard navigation. Put the part inside <Tabs.List>.',
    );
  }

  return context;
}
