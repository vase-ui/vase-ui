import {
  computed,
  inject,
  provide,
  shallowReactive,
  shallowRef,
  watch,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { activeElement } from '../common/shadowDom';
import { ownerDocument, ownerWindow } from '../common/owner';
import { dispatchClickWithModifiers } from '../utils/dispatchClickWithModifiers';
import { isComposing } from '../popup/layer';
import type { MenuContext } from './root';
import { submenuOf } from './root';
import type { MenuFilterProviderChangeEventReason } from './types';

/** What `Menu.FilterProvider` gives to the root directly in it. */
export interface MenuFilterProviderOptions {
  readonly query: string;
  /** Emits the change. `false`: a listener cancelled it. */
  setQuery(value: string, reason: MenuFilterProviderChangeEventReason, event: Event): boolean;
  /** The match of an item, or `null` for no filter. */
  readonly match: ((text: string, query: string) => boolean) | null;
  readonly autoHighlight: boolean | 'always';
}

export const filterProviderKey: InjectionKey<MenuFilterProviderOptions | null> =
  Symbol('menu filter provider');

/** What a filterable menu gives to its parts. The properties are reactive. */
export interface MenuFilterRoot {
  /** The element of `Menu.Input`. */
  readonly input: ShallowRef<HTMLInputElement | null>;
  readonly autoHighlight: boolean | 'always';
  /** The value of the input. */
  readonly query: string;
  /** The input has the focus, and it got it after a key. */
  readonly inputHighlighted: boolean;
  /** The input has the focus. */
  readonly inputFocused: boolean;
  /** The number of items that the query shows. */
  readonly shown: number;
  /** The item with this text is shown. */
  shows(text: () => string): boolean;
  /** Adds an item while it is mounted. */
  addItem(shown: () => boolean): () => void;
  setQuery(value: string, reason: MenuFilterProviderChangeEventReason, event: Event): boolean;
  onInputKeydown(event: KeyboardEvent): void;
  onInputFocus(event: FocusEvent): void;
  onInputBlur(): void;
  /** A key on an item or on the list, which has the real focus, goes to the input. */
  takeKey(event: KeyboardEvent): void;
  /** A move of the pointer in the popup gives the focus back to the input. */
  takePointer(): void;
  connect(menu: MenuContext): void;
}

export function useMenuFilter(provider: MenuFilterProviderOptions): MenuFilterRoot {
  const input = shallowRef<HTMLInputElement | null>(null);
  const items = shallowReactive(new Set<() => boolean>());
  const textVersion = shallowRef(0);
  const keyFocus = shallowRef(false);
  const focused = shallowRef(false);
  const query = computed(() => provider.query.trim());
  let menu: MenuContext | undefined;
  let returning = false;

  const returnFocus = () => {
    returning = true;
    input.value?.focus({ preventScroll: true });
    returning = false;
  };

  const highlightFirst = () => {
    const first = menu?.list.items()[0];
    menu?.list.highlight(first ?? null, 'none');
  };

  const filter: MenuFilterRoot = {
    input,
    get autoHighlight() {
      return provider.autoHighlight;
    },
    get query() {
      return provider.query;
    },
    get inputHighlighted() {
      return keyFocus.value && !menu?.list.highlighted;
    },
    get inputFocused() {
      return focused.value;
    },
    get shown() {
      return [...items].filter((shown) => shown()).length;
    },
    shows(text) {
      const match = provider.match;
      // A text that changes in a hidden item counts.
      void textVersion.value;
      return !match || query.value === '' || match(text(), query.value);
    },
    addItem(shown) {
      items.add(shown);
      return () => items.delete(shown);
    },
    setQuery: (value, reason, event) => provider.setQuery(value, reason, event),
    onInputKeydown(event) {
      const element = input.value;
      if (!menu || !element || event.defaultPrevented || isComposing(event)) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      const { list } = menu;
      const empty = element.value === '';
      const highlighted = list.highlighted;
      const horizontal = menu.orientation === 'horizontal';
      if (event.key === 'Enter' || (event.key === ' ' && empty)) {
        if (!highlighted) return;
        event.preventDefault();
        dispatchClickWithModifiers(highlighted.element, event);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        if (empty && highlighted) list.onKeydown(event);
        return;
      }
      if (horizontal && !highlighted && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const all = list.items();
        const item = event.key === 'ArrowDown' ? all[0] : all.at(-1);
        if (item) list.highlight(item, 'keyboard', event);
        return;
      }
      if (horizontal && !highlighted && !empty) return;
      if (list.onKeydown(event)) return;
      const atEnd = element.selectionStart === element.value.length;
      const atStart = element.selectionEnd === 0;
      const vertical = !horizontal;
      const rtl = ownerWindow(element).getComputedStyle(element).direction === 'rtl';
      const end = vertical ? (rtl ? 'ArrowLeft' : 'ArrowRight') : 'ArrowDown';
      const start = vertical ? (rtl ? 'ArrowRight' : 'ArrowLeft') : 'ArrowUp';
      const submenu = submenuOf(highlighted?.element);
      if (event.key === end && atEnd && submenu && !submenu.disabled) {
        event.preventDefault();
        submenu.openWithKey('first', 'list-navigation', event, highlighted?.element);
      } else if (event.key === start && atStart && menu.parent) {
        event.preventDefault();
        menu.root.request(false, 'list-navigation', event);
      } else if (empty) {
        menu.passUp(event);
      }
    },
    onInputFocus(event) {
      focused.value = true;
      keyFocus.value = (event.target as HTMLElement).matches(':focus-visible');
      if (!menu || returning || provider.autoHighlight === 'always') return;
      // The user moved the focus from an item back to the input.
      const from = event.relatedTarget as Element | null;
      if (from && menu.list.items().some((item) => item.element === from)) {
        menu.list.highlight(null, 'none', event);
      }
    },
    onInputBlur() {
      focused.value = false;
      keyFocus.value = false;
    },
    takeKey(event) {
      if (!menu || event.target === input.value || !input.value) return;
      returnFocus();
      // A key of one character types into the input.
      if (event.key.length === 1 && event.key !== ' ') return;
      filter.onInputKeydown(event);
    },
    takePointer() {
      const element = input.value;
      if (!menu || !element) return;
      const doc = ownerDocument(element);
      const active = activeElement(doc);
      const popup = menu.root.popup;
      const own =
        !active ||
        active === doc.body ||
        active === popup ||
        active === menu.listElement.value ||
        menu.list.items().some((item) => item.element === active);
      if (own && active !== element) returnFocus();
    },
    connect(context) {
      menu = context;
      const { root, list } = context;
      // A change of the query moves the highlight after the items show their new state.
      watch(
        query,
        () => {
          const auto = provider.autoHighlight;
          if (auto === 'always' || (auto && query.value !== '')) highlightFirst();
          else list.highlight(null, 'none');
        },
        { flush: 'post' },
      );
      watch(
        () => root.open && context.placed.value,
        (ready) => {
          if (ready && provider.autoHighlight === 'always' && !list.highlighted) highlightFirst();
        },
        { flush: 'post' },
      );
      // The text of the items, while the query filters them.
      watch(
        () => (root.open && query.value !== '' ? root.popup : null),
        (popup, _, onCleanup) => {
          if (!popup) return;
          const observer = new MutationObserver(() => (textVersion.value += 1));
          observer.observe(popup, { characterData: true, childList: true, subtree: true });
          onCleanup(() => observer.disconnect());
        },
        { flush: 'post' },
      );
      // The query goes back when the popup left the DOM, or at the close of a kept popup.
      watch(
        () => !root.open && (root.keepMounted || !root.popup),
        (gone) => {
          if (gone && provider.query !== '') {
            provider.setQuery('', 'popup-close', new Event('vase-ui'));
          }
        },
      );
    },
  };
  return filter;
}

/** The menu around the part, with its filter. A part of the filter with no filter throws an error. */
export function injectFilter(menu: MenuContext, part: string) {
  if (!menu.filter) {
    throw new Error(
      `Vase UI: <Menu.${part}> must be in a menu inside <Menu.FilterProvider>. Without a provider the menu has no query. Put the root of the menu inside <Menu.FilterProvider>.`,
    );
  }
  return menu.filter;
}

/** A group of items gives its shown state to the group part. */
export interface MenuGroupForItem {
  addItem(shown: () => boolean): () => void;
}

export const groupItemsKey: InjectionKey<MenuGroupForItem | null> = Symbol('menu group items');

/** Adds the shown state of an item to the filter and to its group. */
export function useFilteredItem(menu: MenuContext, text: () => string) {
  const filter = menu.filter;
  const group = inject(groupItemsKey, null);
  const shown = computed(() => !filter || filter.shows(text));
  const removals = [filter?.addItem(() => shown.value), group?.addItem(() => shown.value)];
  return {
    shown,
    remove: () => {
      for (const remove of removals) remove?.();
    },
  };
}

/** A group: its items give their shown state to it. */
export function useGroupItems() {
  const items = shallowReactive(new Set<() => boolean>());
  provide(groupItemsKey, {
    addItem(shown) {
      items.add(shown);
      return () => items.delete(shown);
    },
  });
  return computed(() => items.size === 0 || [...items].some((shown) => shown()));
}
