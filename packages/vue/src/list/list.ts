import { computed, shallowReactive, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { byDocumentOrder } from '../common/element';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../common/owner';
import { activeElement } from '../common/shadowDom';
import { isComposing } from '../popup/layer';

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
  /**
   * The items that a key can reach, in the order of the document: in the document, shown and not
   * `:disabled`. With `hidden`, also the items that are not shown, such as those of a closed popup.
   */
  items(options?: { hidden?: boolean }): ListItem[];
  /** The `label` of the item, else its text, with no space at the ends. */
  text(item: ListItem): string;
  highlight(item: ListItem | null, reason: HighlightReason, event?: Event): void;
  /** The `pointermove` is a move of the pointer, and not content that moved under it. */
  moved(event: PointerEvent): boolean;
  /** Moves the highlight for a key. `true`: the list used the key and prevented its default. */
  onKeydown(event: KeyboardEvent): boolean;
}

export interface ListOptions {
  orientation(): 'vertical' | 'horizontal';
  loop(): boolean;
  /** The element around the items. It takes the focus when the highlight goes, in focus mode. */
  container(): HTMLElement | null;
  /** The element that keeps the focus: the list is in virtual mode. */
  owner?(): HTMLElement | null;
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
  const added = shallowReactive<ListItem[]>([]);
  const highlighted = shallowRef<ListItem | null>(null);
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
    () => !!highlighted.value && !added.includes(highlighted.value),
    (gone) => {
      if (gone) list.highlight(null, 'none');
    },
  );

  function items(itemOptions?: { hidden?: boolean }) {
    return added
      .filter(
        ({ element }) =>
          element.isConnected &&
          (itemOptions?.hidden || element.checkVisibility()) &&
          !element.matches(':disabled'),
      )
      .sort((a, b) => byDocumentOrder(a.element, b.element));
  }

  function rtl() {
    const container = options.container();
    return !!container && ownerWindow(container).getComputedStyle(container).direction === 'rtl';
  }

  // The item of a key in a list of one line. `undefined`: the key is not a key of the list.
  function lineTarget(key: string, all: ListItem[], current: ListItem | null, isRtl: boolean) {
    const orientation = options.orientation();
    const [forward, backward] =
      orientation === 'vertical'
        ? ['ArrowDown', 'ArrowUp']
        : isRtl
          ? ['ArrowLeft', 'ArrowRight']
          : ['ArrowRight', 'ArrowLeft'];
    if (key === 'Home') return all[0];
    if (key === 'End') return all.at(-1);
    if (key !== forward && key !== backward) return undefined;
    if (!current) return key === forward ? all[0] : all.at(-1);
    const next = arrowKeyTarget(
      key,
      current.element,
      all.map((item) => item.element),
      { orientation, rtl: isRtl, loop: false },
    );
    if (next && next !== current.element) return all.find((item) => item.element === next);
    if (options.canLeave?.()) return null;
    if (options.loop()) return key === forward ? all[0] : all.at(-1);
    return current;
  }

  // The item of a key in a list whose items are in rows.
  function rowTarget(key: string, all: ListItem[], current: ListItem | null, isRtl: boolean) {
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

  const list: List = {
    get highlighted() {
      return highlighted.value;
    },
    get virtual() {
      return virtual.value;
    },
    add(item) {
      added.push(item);
      return () => {
        const index = added.indexOf(item);
        if (index !== -1) added.splice(index, 1);
      };
    },
    items,
    text(item) {
      return (item.label ?? item.element.textContent ?? '').trim();
    },
    highlight(item, reason, event) {
      const previous = highlighted.value;
      if (item !== previous) last = { reason, event };
      highlighted.value = item;
      if (item) {
        if (!virtual.value) item.element.focus({ preventScroll: true });
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
    onKeydown(event) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
      if (isComposing(event)) return false;
      const all = items();
      if (all.length === 0) return false;
      const current = highlighted.value?.element.isConnected ? highlighted.value : null;
      const target = (options.rows?.() ? rowTarget : lineTarget)(event.key, all, current, rtl());
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
  let entry: ListItem | undefined;
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
      entry = created;
      onCleanup(list.add(created));
    },
    { flush: 'post', immediate: true },
  );
  const highlighted = computed(
    () => !!element.value && list.highlighted?.element === element.value,
  );
  const options: Partial<ListOptions> = optionsOfLists.get(list) ?? {};
  const hovers = () => options.hover?.() ?? true;

  const attributes = computed<Record<string, unknown>>(() => ({
    tabindex: highlighted.value && !list.virtual ? 0 : -1,
    'data-highlighted': highlighted.value ? '' : undefined,
    onPointermove(event: PointerEvent) {
      if (!entry || event.pointerType === 'touch' || !hovers() || !list.moved(event)) return;
      if (list.highlighted !== entry) list.highlight(entry, 'pointer', event);
    },
    onPointerleave(event: PointerEvent) {
      if (!entry || list.highlighted !== entry || !hovers()) return;
      if (options.keepOnLeave?.(entry)) return;
      const related = event.relatedTarget as Element | null;
      if (related && list.items().some((other) => other.element.contains(related))) return;
      list.highlight(null, 'pointer', event);
    },
    // A screen reader and a touch can give an item the real focus.
    onFocus() {
      if (entry && list.highlighted !== entry) list.highlight(entry, 'none');
    },
    // The owner keeps the focus at a press (test/measurements/menu.test.ts).
    onMousedown: list.virtual ? (event: MouseEvent) => event.preventDefault() : undefined,
  }));
  return { highlighted, attributes };
}
