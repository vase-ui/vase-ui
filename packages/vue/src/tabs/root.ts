import { inject, type InjectionKey } from 'vue';
import { createError } from '../common/createError';
import type { TabsRootState } from './types';

/** A tab of a root, from its `setup` to its unmount. The properties are reactive. */
export interface RootTab {
  readonly value: unknown;
  readonly id: string;
  readonly disabled: boolean;
  /** The element of the tab, after its mount. */
  readonly element: HTMLElement | null;
}

/** A panel of a root, from its `setup` to its unmount. The properties are reactive. */
export interface RootPanel {
  readonly value: unknown;
  readonly id: string;
  /** The panel is in the DOM. */
  readonly shown: boolean;
}

/** What `Tabs.Root` gives to its parts. The properties are reactive. */
export interface TabsRootForParts {
  readonly value: unknown;
  readonly state: TabsRootState;
  /**
   * The tabs: in the order of their elements in the document after the mount, and in the order of
   * their `setup` before it.
   */
  readonly tabs: readonly RootTab[];
  /** The first tab with the value of the root. */
  readonly activeTab: RootTab | undefined;
  /**
   * The tab that has the tab stop while no tab of the list has the focus: the active tab, or else
   * the first tab. Before the mount, a tab knows only the tabs before it, so the first tab has it
   * only for a value of `null`.
   */
  readonly tabStop: RootTab | undefined;
  /** The `id` of the first tab with the value. */
  tabId(value: unknown): string | undefined;
  /** The `id` of the last panel with the value that is in the DOM. */
  panelId(value: unknown): string | undefined;
  /** The user chose the tab with this value. */
  select(value: unknown, event: Event): void;
  /** Adds a tab. Returns the function that removes it. */
  addTab(tab: RootTab): () => void;
  /** Adds a panel. Returns the function that removes it. */
  addPanel(panel: RootPanel): () => void;
}

export const tabsRootKey: InjectionKey<TabsRootForParts> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'tabs root' : undefined,
);

export function injectTabsRoot() {
  const root = inject(tabsRootKey, null);
  if (!root) {
    throw createError(64);
  }
  return root;
}

/** The attributes that each part writes from the state of the root. */
export function rootStateAttributes(state: TabsRootState) {
  return {
    'data-orientation': state.orientation,
    'data-activation-direction': state.tabActivationDirection,
  };
}
