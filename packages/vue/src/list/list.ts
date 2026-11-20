import {
  computed,
  nextTick,
  shallowReactive,
  shallowRef,
  watch,
  type ComputedRef,
  type Ref,
} from 'vue';
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
  /** The items that a key can reach, in the order of the document. */
  items(): ListItem[];
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

  // The place of the pointer, from the events in the container. A `pointerover` alone is no
  // reference: a move in one step sends `pointerover` and then `pointermove` at one place
  // (test/measurements/menu.test.ts). A second `pointerover` at the place of the first one comes
  // from content that moved under a pointer that rests.
  let known: Point | null = null;
  let over: Point | null = null;
  const moves = new WeakMap<Event, boolean>();
  watch(
    options.container,
    (container, _, onCleanup) => {
      if (!container) return;
      onCleanup(
        mergeCleanups(
          addEventListener(
            container,
            'pointermove',
            (event) => {
              moves.set(event, !same(known, event));
              known = { x: event.clientX, y: event.clientY };
            },
            true,
          ),
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
            known = null;
            over = null;
          }),
        ),
      );
    },
    { flush: 'post', immediate: true },
  );

  // An item that leaves the list takes the highlight with it.
  watch(
    () => added.length,
    () => {
      const current = highlighted.value;
      if (current && !added.includes(current)) list.highlight(null, 'none');
    },
  );

  function items() {
    return added
      .filter(
        ({ element }) =>
          element.isConnected && element.checkVisibility() && !element.matches(':disabled'),
      )
      .sort((a, b) => byDocumentOrder(a.element, b.element));
  }

  function rtl() {
    const container = options.container();
    return !!container && ownerWindow(container).getComputedStyle(container).direction === 'rtl';
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
      highlighted.value = item;
      if (item) {
        if (!virtual.value) item.element.focus({ preventScroll: true });
        // `focus()` alone puts the item in the middle of the list
        // (test/measurements/menu.test.ts). A pointer scrolls nothing, so the list does not move
        // under it.
        if (reason !== 'pointer') item.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      } else if (!virtual.value && previous) {
        const active = activeElement(ownerDocument(previous.element));
        if (active && previous.element.contains(active)) {
          options.container()?.focus({ preventScroll: true });
        }
      }
      if (item !== previous) void nextTick(() => options.onHighlight?.(item, reason, event));
    },
    moved(event) {
      return moves.get(event) ?? true;
    },
    onKeydown(event) {
      if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
      if (isComposing(event)) return false;
      const all = items();
      if (all.length === 0) return false;
      const orientation = options.orientation();
      const isRtl = rtl();
      const [forward, backward] =
        orientation === 'vertical'
          ? ['ArrowDown', 'ArrowUp']
          : isRtl
            ? ['ArrowLeft', 'ArrowRight']
            : ['ArrowRight', 'ArrowLeft'];
      const current = highlighted.value?.element.isConnected ? highlighted.value : null;
      let target: ListItem | null | undefined;
      if (event.key === 'Home') target = all[0];
      else if (event.key === 'End') target = all.at(-1);
      else if (event.key !== forward && event.key !== backward) return false;
      else if (!current) target = event.key === forward ? all[0] : all.at(-1);
      else {
        const next = arrowKeyTarget(
          event.key,
          current.element,
          all.map((item) => item.element),
          { orientation, rtl: isRtl, loop: false },
        );
        if (next && next !== current.element) target = all.find((item) => item.element === next);
        else if (options.canLeave?.()) target = null;
        else if (options.loop()) target = event.key === forward ? all[0] : all.at(-1);
        else target = current;
      }
      event.preventDefault();
      if (target !== undefined) list.highlight(target, 'keyboard', event);
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
  item: { label(): string | undefined; disabled(): boolean },
): { highlighted: ComputedRef<boolean>; attributes: ComputedRef<Record<string, unknown>> } {
  let entry: ListItem | undefined;
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      const created: ListItem = {
        element: el,
        get label() {
          return item.label();
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
  const highlighted = computed(() => !!element.value && list.highlighted?.element === element.value);
  const options = optionsOfLists.get(list) ?? {};
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
