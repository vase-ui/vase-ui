import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { RootTab } from './root';

/** What `Tabs.List` gives to a tab and an indicator. The properties are reactive. */
export interface TabsListForParts {
  readonly element: HTMLElement | null;
  /** The tab that has `tabindex="0"`. */
  readonly tabStop: RootTab | undefined;
  /** A key on a tab. The list moves the focus for the keys of the list. */
  onKeydown(event: KeyboardEvent, tab: RootTab): void;
  /** A tab got the focus. */
  onFocus(tab: RootTab): void;
  /** A tab lost the focus. A browser sends `blur` before the `focus` of the next element. */
  onBlur(): void;
}

export const tabsListKey: InjectionKey<TabsListForParts> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'tabs list' : undefined,
);

export function injectTabsList() {
  const list = inject(tabsListKey, null);
  if (!list) {
    throw createError(63);
  }
  return list;
}
