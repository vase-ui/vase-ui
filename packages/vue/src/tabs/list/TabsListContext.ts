import { inject } from 'vue';
import type { ComputedRef, InjectionKey, Ref } from 'vue';

export interface TabsListContext {
  activateOnFocus: ComputedRef<boolean>;
  resizeCount: Readonly<Ref<number>>;
  tabElements: Readonly<Ref<readonly (HTMLElement | null)[]>>;
  tabsListElement: Readonly<Ref<HTMLElement | null>>;
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
