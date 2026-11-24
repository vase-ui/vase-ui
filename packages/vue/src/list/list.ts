import { computed, shallowRef, watch, type ComputedRef, type Ref, type ShallowRef } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { inDocumentOrder } from '../common/element';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { focusAs } from '../popup/focus';
import { isComposing } from '../popup/layer';
import type { InteractionType } from '../popup/root';

export type HighlightReason = 'keyboard' | 'pointer' | 'none';

/** An item of a list, while its element is mounted. The properties are reactive. */
export interface ListItem {
  readonly element: HTMLElement;
  /** The `label` prop of the part. */
  readonly label: string | undefined;
  /** The part does no action. The item keeps the highlight. */
  readonly disabled: boolean;
}

/** A list of items with one highlighted item. The properties are reactive. */
export interface List {
  readonly highlighted: ListItem | null;
  /** One other element keeps the focus, and names the highlighted item. */
  readonly virtual: boolean;
  add(item: ListItem): () => void;
  /** The item has the highlight. A change of the highlight updates the readers of two items only. */
  isHighlighted(item: ListItem): boolean;
  /**
   * The items that a key can reach, in the order of the document: in the document, shown and not
   * `:disabled`. With `hidden`, also the items that are not shown, such as those of a closed popup.
   */
  items(options?: { hidden?: boolean }): ListItem[];
  /**
   * The first item of `items()` that matches. It checks only the items up to that item, so a long
   * list costs less than with `items()`.
   */
  find(match?: (item: ListItem) => boolean): ListItem | undefined;
  /** The last item of `items()` that matches. It checks only the items from the end to that item. */
  findLast(match?: (item: ListItem) => boolean): ListItem | undefined;
  /** The place of the item in `items()`, or -1. It checks only the items up to that item. */
  indexOf(item: ListItem): number;
  /**
   * The first or the last item that is not disabled. A key that opens a popup highlights it, and
   * an arrow key in the open list still reaches a disabled item.
   */
  edge(which: 'first' | 'last'): ListItem | undefined;
  /** The `label` of the item, else its text, with no space at the ends. */
  text(item: ListItem): string;
  highlight(item: ListItem | null, reason: HighlightReason, event?: Event): void;
  /** The `pointermove` is a move of the pointer, and not content that moved under it. */
  moved(event: PointerEvent): boolean;
  /**
   * Moves the highlight for a key. `true`: the list used the key and prevented its default. An
   * arrow key moves from `from`. With `from` `null`, it goes to the first or the last item. With no
   * `from`, it moves from the highlighted item, or from the end of the list for a key on an element
   * of the popup that is no item.
   */
  onKeydown(event: KeyboardEvent, from?: ListItem | null): boolean;
}

export interface ListOptions {
  orientation(): 'vertical' | 'horizontal';
  loop(): boolean;
  /** The element around the items. It takes the focus when the highlight goes, in focus mode. */
  container(): HTMLElement | null;
  /** The element that keeps the focus: the list is in virtual mode. */
  owner?(): HTMLElement | null;
  /**
   * The input that opened the list. The first highlight of an open focuses its item as that input
   * would.
   */
  interaction?(): InteractionType;
  /** An arrow key at an end removes the highlight. */
  canLeave?(): boolean;
  /** A move of the pointer highlights its item. The default is `true`. */
  hover?(): boolean;
  /** A pointer that leaves the item keeps its highlight. */
  keepOnLeave?(item: ListItem): boolean;
  /**
   * The items are in elements with the role `row`. The keys of the orientation move in a row, and
   * the two other arrow keys move to the same column of another row.
   */
  rows?(): boolean;
  /** Runs after the DOM update of each change of the highlight. */
  onHighlight?(item: ListItem | null, reason: HighlightReason, event: Event | undefined): void;
}

type Point = { x: number; y: number };

// The options of each list, for its items.
const optionsOfLists = new WeakMap<List, ListOptions>();

const same = (a: Point | null, event: PointerEvent) =>
  !!a && a.x === event.clientX && a.y === event.clientY;

export function useList(options: ListOptions): List {
  // The items by element. An item leaves in constant time, so a filter that removes many items of a
  // long list stays linear. A walk of the container finds the item of each element here. A reader
  // of the items reads `addedVersion`, which changes at each add and each removal.
  const added = new Map<Element, ListItem>();
  const addedVersion = shallowRef(0);
  const highlighted = shallowRef<ListItem | null>(null);
  const itemHighlights = new WeakMap<ListItem, ShallowRef<boolean>>();
  const setItemHighlight = (item: ListItem | null, on: boolean) => {
    const itemHighlight = item && itemHighlights.get(item);
    if (itemHighlight) itemHighlight.value = on;
  };
  const virtual = computed(() => !!options.owner?.());

  // The place of the pointer, from the `pointermove` events of the document of the owner, else of
  // the container. A list then knows the place of a pointer that rests where it opens: WebKit on
  // Linux gives no `pointerover` there, and after a scroll it gives a `pointermove` at that place.
  // A `pointerover` alone is no reference: a move in one step sends `pointerover` and then
  // `pointermove` at one place (test/measurements/menu.test.ts). A second `pointerover` at the place
  // of the first one comes from content that moved under a pointer that rests.
  let known: Point | null = null;
  let over: Point | null = null;
  const moves = new WeakMap<Event, boolean>();
  watch(
    () => options.owner?.() ?? options.container(),
    (element, _, onCleanup) => {
      if (!element) return;
      onCleanup(
        mergeCleanups(
          addEventListener(
            ownerDocument(element),
            'pointermove',
            (event) => {
              moves.set(event, !same(known, event));
              known = { x: event.clientX, y: event.clientY };
            },
            true,
          ),
          () => {
            known = null;
          },
        ),
      );
    },
    { flush: 'post', immediate: true },
  );
  watch(
    () => options.container(),
    (container, _, onCleanup) => {
      if (!container) return;
      onCleanup(
        mergeCleanups(
          addEventListener(
            container,
            'pointerover',
            (event) => {
              if (same(over, event)) known = { x: event.clientX, y: event.clientY };
              over = { x: event.clientX, y: event.clientY };
            },
            true,
          ),
          addEventListener(container, 'pointerleave', () => {
            over = null;
          }),
        ),
      );
    },
    { flush: 'post', immediate: true },
  );

  // The cause of the last change of the highlight. The watcher of `onHighlight` comes before the
  // watchers of the caller, which then see the reason of the change.
  let last: { reason: HighlightReason; event: Event | undefined } = {
    reason: 'none',
    event: undefined,
  };
  watch(highlighted, (item) => options.onHighlight?.(item, last.reason, last.event), {
    flush: 'post',
  });

  // An item that leaves the list takes the highlight with it, also when another item takes its
  // place in the same update.
  watch(
    () => {
      void addedVersion.value;
      const item = highlighted.value;
      return !!item && added.get(item.element) !== item;
    },
    (gone) => {
      if (gone) list.highlight(null, 'none');
    },
  );

  const reachable = (element: Element, hidden?: boolean) =>
    (hidden || shown(element)) && !element.matches(':disabled');

  // An item with `visibility: hidden` takes no focus, and `checkVisibility()` counts it as shown
  // with no option. A popup has `visibility: hidden` until it is placed, and its items count then.
  // A shown item needs one check.
  function shown(element: Element) {
    if (element.checkVisibility({ visibilityProperty: true })) return true;
    const container = options.container();
    return !container?.checkVisibility({ visibilityProperty: true }) && element.checkVisibility();
  }

  // The items in the document, in the order of the document.
  function connected() {
    void addedVersion.value;
    const inDocument = [...added.values()].filter(({ element }) => element.isConnected);
    return inDocumentOrder(inDocument, (item) => item.element, options.container());
  }

  function items(itemOptions?: { hidden?: boolean }) {
    return connected().filter(({ element }) => reachable(element, itemOptions?.hidden));
  }

  // A check of the visibility takes the most time, so it comes after the match.
  function find(match: (item: ListItem) => boolean = () => true, reversed = false) {
    const all = connected();
    if (reversed) all.reverse();
    return all.find((item) => match(item) && reachable(item.element));
  }

  // The item that a step from the element reaches, in the order of the document. A walk from the
  // element finds it, so a step reads only the elements up to that item. `undefined`: the container
  // has no such item.
  function stepInContainer(from: HTMLElement, forward: boolean) {
    const container = options.container();
    if (!container?.contains(from)) return undefined;
    const walker = ownerDocument(container).createTreeWalker(container, NodeFilter.SHOW_ELEMENT);
    walker.currentNode = from;
    const next = () => (forward ? walker.nextNode() : walker.previousNode());
    for (let node = next(); node; node = next()) {
      const item = added.get(node as Element);
      if (item && reachable(item.element)) return item;
    }
    return undefined;
  }

  // The element is an item or is in one. A walk up from the element reads no other item.
  function inItem(element: Element, holder: Element) {
    for (let node: Element | null = element; node && node !== holder; node = node.parentElement) {
      if (added.has(node)) return true;
    }
    return false;
  }

  function rtl() {
    const container = options.container();
    return !!container && ownerWindow(container).getComputedStyle(container).direction === 'rtl';
  }

  // The item of a key in a list of one line. `undefined`: the key is not a key of the list, or the
  // list has no item.
  function lineTarget(key: string, current: ListItem | null) {
    const orientation = options.orientation();
    const isRtl = orientation === 'horizontal' && rtl();
    const [forward, backward] =
      orientation === 'vertical'
        ? ['ArrowDown', 'ArrowUp']
        : isRtl
          ? ['ArrowLeft', 'ArrowRight']
          : ['ArrowRight', 'ArrowLeft'];
    const isStep = key === forward || key === backward;
    if (!isStep && key !== 'Home' && key !== 'End') return undefined;
    const near = current && isStep ? stepInContainer(current.element, key === forward) : undefined;
    if (near) return near;
    const all = items();
    if (all.length === 0) return undefined;
    if (key === 'Home') return all[0];
    if (key === 'End') return all.at(-1);
    if (!current) return key === forward ? all[0] : all.at(-1);
    // A highlighted item that a key cannot reach, such as one that hides, keeps its place.
    const sequence = all.includes(current)
      ? all
      : inDocumentOrder([...all, current], (item) => item.element, options.container());
    const next = sequence[sequence.indexOf(current) + (key === forward ? 1 : -1)];
    if (next) return next;
    if (options.canLeave?.()) return null;
    if (options.loop()) return key === forward ? all[0] : all.at(-1);
    return current;
  }

  // The item of a key in a list whose items are in rows.
  function rowTarget(key: string, current: ListItem | null) {
    const all = items();
    if (all.length === 0) return undefined;
    const isRtl = rtl();
    const rows: ListItem[][] = [];
    let row: Element | null | undefined;
    for (const item of all) {
      const around = item.element.closest('[role="row"]');
      if (around !== row || rows.length === 0) rows.push([item]);
      else rows.at(-1)?.push(item);
      row = around;
    }
    const [forward, back] = isRtl ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
    if (!current) {
      if (key === 'ArrowDown') return all[0];
      if (key === 'ArrowUp') return all.at(-1);
      return undefined;
    }
    const rowIndex = rows.findIndex((each) => each.includes(current));
    const column = rows[rowIndex]?.indexOf(current) ?? 0;
    if (key === forward || key === back) {
      const step = key === forward ? 1 : -1;
      return (
        all[all.indexOf(current) + step] ??
        (options.loop() ? (step === 1 ? all[0] : all.at(-1)) : current)
      );
    }
    if (key !== 'ArrowDown' && key !== 'ArrowUp') return undefined;
    const step = key === 'ArrowDown' ? 1 : -1;
    let nextRow: ListItem[] | undefined = rows[rowIndex + step];
    if (!nextRow) {
      if (options.canLeave?.()) return null;
      if (!options.loop()) return current;
      nextRow = step === 1 ? rows[0] : rows.at(-1);
    }
    return nextRow?.[column] ?? nextRow?.at(-1);
  }

  // A hover is an input of the pointer, and an arrow key one of the keyboard.
  const inputOf = (reason: HighlightReason): InteractionType =>
    reason === 'pointer'
      ? 'mouse'
      : reason === 'keyboard'
        ? 'keyboard'
        : (options.interaction?.() ?? '');

  const list: List = {
    get highlighted() {
      return highlighted.value;
    },
    get virtual() {
      return virtual.value;
    },
    add(item) {
      itemHighlights.set(item, shallowRef(false));
      added.set(item.element, item);
      addedVersion.value += 1;
      return () => {
        if (added.get(item.element) !== item) return;
        added.delete(item.element);
        addedVersion.value += 1;
      };
    },
    isHighlighted(item) {
      return itemHighlights.get(item)?.value ?? false;
    },
    items,
    find: (match) => find(match),
    findLast: (match) => find(match, true),
    indexOf(item) {
      let index = 0;
      for (const each of connected()) {
        if (each === item) return reachable(item.element) ? index : -1;
        if (reachable(each.element)) index += 1;
      }
      return -1;
    },
    edge: (which) => find((item) => !item.disabled, which === 'last'),
    text(item) {
      return (item.label ?? item.element.textContent ?? '').trim();
    },
    highlight(item, reason, event) {
      const previous = highlighted.value;
      if (item !== previous) {
        last = { reason, event };
        setItemHighlight(previous, false);
        setItemHighlight(item, true);
      }
      highlighted.value = item;
      if (item) {
        if (!virtual.value) focusAs(item.element, inputOf(reason));
        // `focus()` alone puts the item in the middle of the list
        // (test/measurements/menu.test.ts). A pointer scrolls nothing, so the list does not move
        // under it.
        if (reason !== 'pointer')
          item.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else if (!virtual.value && previous) {
        const active = activeElement(ownerDocument(previous.element));
        if (active && previous.element.contains(active)) {
          options.container()?.focus({ preventScroll: true });
        }
      }
    },
    moved(event) {
      return moves.get(event) ?? true;
    },
    onKeydown(event, from) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
      if (isComposing(event)) return false;
      // A key on the list or on an element of the popup that is no item, such as a button beside
      // the list, starts at the end of the list, also when that end has the highlight (Base UI). A
      // key that a submenu gives to its parent goes on from the highlight of the parent. In a list
      // that is not virtual, a key on the trigger of an open popup also starts at the end: the focus
      // of the trigger removes the highlight.
      const holder = event.currentTarget as Element | null;
      const container = options.container();
      const active =
        from === undefined && holder && container && holder.contains(container) && !virtual.value
          ? activeElement(ownerDocument(holder))
          : null;
      const outsideItems =
        !!active &&
        !!holder?.contains(active) &&
        (active !== holder || active === container) &&
        !inItem(active, holder);
      const start = outsideItems ? null : from === undefined ? highlighted.value : from;
      const current = start?.element.isConnected ? start : null;
      const target = (options.rows?.() ? rowTarget : lineTarget)(event.key, current);
      if (target === undefined) return false;
      event.preventDefault();
      list.highlight(target, 'keyboard', event);
      return true;
    },
  };
  optionsOfLists.set(list, options);
  return list;
}

/**
 * Adds the element to the list while it is mounted. Gives the highlight state and the attributes
 * of the item: its `tabindex`, `data-highlighted`, and the listeners of the pointer and the focus.
 */
export function useListItem(
  list: List,
  element: Readonly<Ref<HTMLElement | null>>,
  item: { label?(): string | undefined; disabled(): boolean },
): { highlighted: ComputedRef<boolean>; attributes: ComputedRef<Record<string, unknown>> } {
  const entry = shallowRef<ListItem>();
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      const created: ListItem = {
        element: el,
        get label() {
          return item.label?.();
        },
        get disabled() {
          return item.disabled();
        },
      };
      onCleanup(list.add(created));
      entry.value = created;
    },
    { flush: 'post', immediate: true },
  );
  const highlighted = computed(() => !!entry.value && list.isHighlighted(entry.value));
  const options: Partial<ListOptions> = optionsOfLists.get(list) ?? {};
  const hovers = () => options.hover?.() ?? true;

  const attributes = computed<Record<string, unknown>>(() => ({
    tabindex: highlighted.value && !list.virtual ? 0 : -1,
    'data-highlighted': highlighted.value ? '' : undefined,
    onPointermove(event: PointerEvent) {
      const current = entry.value;
      if (!current || event.pointerType === 'touch' || !hovers() || !list.moved(event)) return;
      if (list.highlighted !== current) list.highlight(current, 'pointer', event);
    },
    onPointerleave(event: PointerEvent) {
      const current = entry.value;
      if (!current || list.highlighted !== current || !hovers()) return;
      if (options.keepOnLeave?.(current)) return;
      const related = event.relatedTarget as Element | null;
      if (related && list.find((other) => other.element.contains(related))) return;
      list.highlight(null, 'pointer', event);
    },
    // A screen reader and a touch can give an item the real focus.
    onFocus() {
      const current = entry.value;
      if (current && list.highlighted !== current) list.highlight(current, 'none');
    },
    // The owner keeps the focus at a press (test/measurements/menu.test.ts).
    onMousedown: list.virtual ? (event: MouseEvent) => event.preventDefault() : undefined,
  }));
  return { highlighted, attributes };
}
