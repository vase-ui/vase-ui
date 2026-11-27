import {
  computed,
  inject,
  onScopeDispose,
  provide,
  shallowReactive,
  shallowRef,
  watch,
  type InjectionKey,
  type ShallowRef,
} from 'vue';
import { createError } from '../common/createError';
import { activeElement } from '../common/shadowDom';
import { ownerDocument, ownerWindow } from '../common/owner';
import { dispatchClickWithModifiers } from '../common/dispatchClickWithModifiers';
import { isComposing } from '../popup/layer';
import type { MenuContext } from './root';
import { submenuOf } from './root';
import type { MenuFilterProviderChangeEventReason } from './types';
import type { HighlightReason } from '../list/list';

/** What `Menu.FilterProvider` gives to the root directly in it. */
export interface MenuFilterProviderOptions {
  readonly query: string;
  /** Emits the change. `false`: a listener cancelled it. */
  setQuery(value: string, reason: MenuFilterProviderChangeEventReason, event: Event): boolean;
  /** The match of an item, or `null` for no filter. */
  readonly match: ((text: string, query: string) => boolean) | null;
  readonly autoHighlight: boolean | 'always';
}

export const filterProviderKey: InjectionKey<MenuFilterProviderOptions | null> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'menu filter provider' : undefined,
);

/** What a filterable menu gives to its parts. The properties are reactive. */
export interface MenuFilterRoot {
  /** The element of `Menu.Input`. */
  readonly input: ShallowRef<HTMLInputElement | null>;
  readonly autoHighlight: boolean | 'always';
  /** The value of the input. */
  readonly query: string;
  /** The input has the focus after a key, and no key moved the highlight to an item. */
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
  /** A move of the pointer in the popup gives the focus to the input. */
  takePointer(event: PointerEvent): void;
  /** The input got the focus from a pointer that moved into the popup from a parent menu. */
  readonly pointerFocus: boolean;
  /** The reason of the last change of the highlight. */
  noteHighlight(reason: HighlightReason): void;
  connect(menu: MenuContext): void;
}

export function useMenuFilter(provider: MenuFilterProviderOptions): MenuFilterRoot {
  const input = shallowRef<HTMLInputElement | null>(null);
  const items = shallowReactive(new Set<() => boolean>());
  const textVersion = shallowRef(0);
  const keyFocus = shallowRef(false);
  const focused = shallowRef(false);
  const pointerHighlight = shallowRef(false);
  let pointerFocus = false;
  const query = computed(() => provider.query.trim());
  let menu: MenuContext | undefined;
  let returning = false;

  const returnFocus = () => {
    returning = true;
    input.value?.focus({ preventScroll: true });
    returning = false;
  };

  const highlightFirst = () => {
    if (menu) menu.list.highlight(menu.list.find() ?? null, 'none');
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
      return keyFocus.value && (!menu?.list.highlighted || pointerHighlight.value);
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
      const { list } = menu;
      const empty = element.value === '';
      const highlighted = list.highlighted;
      const horizontal = menu.orientation === 'horizontal';
      // Enter clicks the highlighted item with its modifiers, as on an item that has the focus, so
      // Ctrl+Enter on a link item opens a new tab.
      if (event.key === 'Enter') {
        if (!highlighted) return;
        event.preventDefault();
        press(highlighted.element, event);
        return;
      }
      // Shift with an arrow key, Home or End selects text.
      if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return;
      // Space in the empty input clicks the highlighted item, and types no space at the start.
      if (event.key === ' ' && empty) {
        event.preventDefault();
        if (highlighted) press(highlighted.element, event);
        return;
      }
      if (event.key === 'Home' || event.key === 'End') {
        if (empty && highlighted) list.onKeydown(event);
        return;
      }
      if (horizontal && !highlighted && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        event.preventDefault();
        const item = event.key === 'ArrowDown' ? list.find() : list.findLast();
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
        menu.root.request(false, 'list-navigation', event);
      } else if (empty) {
        menu.passUp(event);
      }
    },
    onInputFocus(event) {
      focused.value = true;
      pointerFocus = false;
      keyFocus.value = (event.target as HTMLElement).matches(':focus-visible');
      if (!menu || returning || provider.autoHighlight === 'always') return;
      // The user moved the focus from an item back to the input.
      const from = event.relatedTarget as Element | null;
      if (from && menu.list.find((item) => item.element === from)) {
        menu.list.highlight(null, 'none', event);
      }
    },
    onInputBlur() {
      focused.value = false;
      keyFocus.value = false;
      pointerFocus = false;
    },
    takeKey(event) {
      if (!menu || event.target === input.value || !input.value) return;
      returnFocus();
      filter.onInputKeydown(event);
    },
    takePointer(event) {
      const element = input.value;
      // A tap gives `pointermove` too, and the focus of the input would raise the keyboard.
      if (!menu || !element || event.pointerType !== 'mouse') return;
      const doc = ownerDocument(element);
      const active = activeElement(doc);
      if (active === element) return;
      const target = event.target as Element;
      const child = menu.openChild;
      // A submenu with no portal is in this popup, and it takes its own pointer.
      if (child?.root.popup?.contains(target)) return;
      const popup = menu.root.popup;
      const own =
        !active ||
        active === doc.body ||
        active === popup ||
        active === menu.listElement.value ||
        !!menu.list.find((item) => item.element === active);
      if (own) {
        returnFocus();
        return;
      }
      // The pointer came from a parent menu, whose element has the focus.
      if (inParent(menu, active)) {
        returnFocus();
        pointerFocus = true;
        return;
      }
      // The focus that followed the pointer into a submenu follows it back. A focus that a key or
      // a press gave to the submenu comes back when the pointer is on a submenu trigger.
      if (!child?.inside(active)) return;
      const onTrigger = !!menu.list.find(
        (item) => !!submenuOf(item.element) && item.element.contains(target),
      );
      if (onTrigger || (active === child.filter?.input.value && child.filter.pointerFocus)) {
        returnFocus();
      }
    },
    get pointerFocus() {
      return pointerFocus;
    },
    noteHighlight(reason) {
      pointerHighlight.value = reason === 'pointer';
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
      // The query goes back when the popup left the DOM, at the close of a kept popup, and when
      // the menu unmounts, as a submenu in the popup of its parent does.
      const reset = () => {
        if (provider.query !== '') provider.setQuery('', 'popup-close', new Event('vase-ui'));
      };
      watch(
        () => !root.open && (root.keepMounted || !root.popup),
        (gone) => {
          if (gone) reset();
        },
      );
      onScopeDispose(reset);
    },
  };
  return filter;
}

/** The element is in the popup of a menu around this one. */
function inParent(menu: MenuContext, element: Element) {
  for (let parent = menu.parent; parent; parent = parent.parent) {
    if (parent.root.popup?.contains(element)) return true;
  }
  return false;
}

/**
 * A key on the input clicks the highlighted item. On a submenu trigger, it opens a closed submenu
 * or enters one that a hover opened, and closes one that a press opened.
 */
function press(element: HTMLElement, event: KeyboardEvent) {
  const submenu = submenuOf(element);
  if (!submenu) {
    dispatchClickWithModifiers(element, event);
    return;
  }
  if (submenu.disabled) return;
  if (!submenu.root.open || submenu.hoverOpen) {
    submenu.openWithKey('first', 'trigger-press', event, element);
  } else {
    submenu.root.request(false, 'trigger-press', event, element);
  }
}

/** The menu around the part, with its filter. A part of the filter with no filter throws an error. */
export function injectFilter(menu: MenuContext, part: string) {
  if (!menu.filter) {
    throw createError(31, part);
  }
  return menu.filter;
}

/** A group of items gives its shown state to the group part. */
export interface MenuGroupForItem {
  addItem(shown: () => boolean): () => void;
}

export const groupItemsKey: InjectionKey<MenuGroupForItem | null> = Symbol(
  process.env.NODE_ENV !== 'production' ? 'menu group items' : undefined,
);

/**
 * Adds the shown state of an item to the filter and to its group. An item shows while its text
 * matches the query, or while `keep` is `true`.
 */
export function useFilteredItem(menu: MenuContext, text: () => string, keep?: () => boolean) {
  const filter = menu.filter;
  const group = inject(groupItemsKey, null);
  const matches = computed(() => !filter || filter.shows(text));
  const shown = computed(() => matches.value || !!keep?.());
  const removals = [filter?.addItem(() => shown.value), group?.addItem(() => shown.value)];
  return {
    matches,
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
