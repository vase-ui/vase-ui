import { inject, type InjectionKey } from 'vue';
import type { RootTab } from './root';

/** What `Tabs.List` gives to a tab and an indicator. The properties are reactive. */
export interface TabsListForParts {
  readonly element: HTMLElement | null;
  /** The tab that has `tabindex="0"`. */
  readonly tabStop: RootTab | undefined;
  /** A key on a tab. The list moves the focus for the keys of the list. */
  onKeydown(event: KeyboardEvent, tab: RootTab): void;
  /** A tab got or lost the focus. */
  onFocus(tab: RootTab): void;
  onBlur(tab: RootTab): void;
}

export const tabsListKey: InjectionKey<TabsListForParts> = Symbol('tabs list');

export function injectTabsList() {
  const list = inject(tabsListKey, null);
  if (!list) {
    throw new Error(
      'Vase UI: A tab or an indicator of Tabs must be inside <Tabs.List>. Without a list the part has no list element to read and no keyboard navigation. Put the part inside <Tabs.List>.',
    );
  }
  return list;
}
