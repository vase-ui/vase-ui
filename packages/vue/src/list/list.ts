import { computed, shallowReactive, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { byDocumentOrder } from '../common/element';
import { mergeCleanups } from '../common/mergeCleanups';
import { ownerWindow } from '../common/owner';
import { isComposing } from '../popup/layer';

/** An item of a list, while it is mounted. The properties are reactive. */
export interface ListItem {
  readonly element: HTMLElement;
  /** The `label` prop of the item. */
  readonly label: string | undefined;
  /** The item keeps the highlight, and its part does no action. */
  readonly disabled: boolean;
}

export type ListHighlightReason = 'keyboard' | 'pointer' | 'none';

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
  highlight(item: ListItem | null, reason: ListHighlightReason, event?: Event): void;
  /** The `pointermove` is a move of the pointer, not a move of the content under it. */
  moved(event: PointerEvent): boolean;
  /** The list used the key and prevented its default. */
  onKeydown(event: KeyboardEvent): boolean;
}

export interface ListOptions {
  orientation(): 'vertical' | 'horizontal';
  loop(): boolean;
  /** The element around the items. */
  container(): HTMLElement | null;
  /** An arrow key at an end removes the highlight. */
  canLeave?(): boolean;
  /** A pointer move highlights its item. */
  hover?(): boolean;
  /** A pointer leave keeps the highlight of this item. */
  keepOnLeave?(item: ListItem): boolean;
  /**
   * The items are in elements with the role `row`. The keys of the orientation move in a row, and
   * the two other arrow keys move to the same column of another row.
   */
  rows?(): boolean;
  /** Runs after the DOM update of each change of the highlight. */
  onHighlight?(item: ListItem | null, reason: ListHighlightReason, event: Event | undefined): void;
}

/**
 * A list in the virtual mode: the owner keeps the focus and names the highlighted item with
 * `aria-activedescendant`.
 */
export function useList(options: ListOptions): List {
  const added = shallowReactive<ListItem[]>([]);
  const highlighted = shallowRef<ListItem | null>(null);
  let last: { reason: ListHighlightReason; event: Event | undefined } = {
    reason: 'none',
    event: undefined,
  };
  // The position of the pointer, while the list knows it.
  let pointer: { x: number; y: number } | null = null;

  watch(highlighted, (item) => options.onHighlight?.(item, last.reason, last.event), {
    flush: 'post',
  });

  watch(
    () => options.container(),
    (container, _, onCleanup) => {
      pointer = null;
      if (!container) return;
      onCleanup(
        mergeCleanups(
          addEventListener(container, 'pointermove', (event) => {
            const isMove = moved(event);
            pointer = { x: event.clientX, y: event.clientY };
            const item = isMove && hovers() ? itemOf(event.target) : undefined;
            if (item) highlight(item, 'pointer', event);
          }),
          addEventListener(container, 'pointerout', (event) => {
            const item = highlighted.value;
            if (!item || !hovers() || !item.element.contains(event.target as Node)) return;
            const to = event.relatedTarget as Node | null;
            if (item.element.contains(to) || itemOf(to) || options.keepOnLeave?.(item)) return;
            highlight(null, 'pointer', event);
          }),
          addEventListener(container, 'pointerleave', () => (pointer = null)),
        ),
      );
    },
    { flush: 'post' },
  );

  const hovers = () => options.hover?.() ?? true;

  // The innermost item around the node.
  function itemOf(node: EventTarget | null) {
    return added
      .filter(({ element }) => element.contains(node as Node | null))
      .sort((a, b) => byDocumentOrder(b.element, a.element))[0];
  }

  function moved(event: PointerEvent) {
    return pointer?.x !== event.clientX || pointer.y !== event.clientY;
  }

  function items() {
    return added
      .filter(
        ({ element }) =>
          element.isConnected && element.checkVisibility() && !element.matches(':disabled'),
      )
      .sort((a, b) => byDocumentOrder(a.element, b.element));
  }

  function highlight(item: ListItem | null, reason: ListHighlightReason, event?: Event) {
    if (item === highlighted.value) return;
    last = { reason, event };
    highlighted.value = item;
    // A pointer highlight scrolls nothing, so the list does not move under the pointer.
    if (item && reason !== 'pointer') {
      item.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
  }

  function isRtl() {
    const container = options.container();
    return !!container && ownerWindow(container).getComputedStyle(container).direction === 'rtl';
  }

  function target(key: string, list: ListItem[]): ListItem | null | undefined {
    const current =
      highlighted.value && list.includes(highlighted.value) ? highlighted.value : null;
    const orientation = options.orientation();
    const rtl = isRtl();
    if (options.rows?.()) return rowTarget(key, list, current, rtl);
    const [next, previous] =
      orientation === 'vertical'
        ? ['ArrowDown', 'ArrowUp']
        : rtl
          ? ['ArrowLeft', 'ArrowRight']
          : ['ArrowRight', 'ArrowLeft'];
    if (key === 'Home') return list[0];
    if (key === 'End') return list.at(-1);
    if (key !== next && key !== previous) return undefined;
    if (!current) return key === next ? list[0] : list.at(-1);
    const atEnd = key === next ? current === list.at(-1) : current === list[0];
    if (atEnd && options.canLeave?.()) return null;
    const element = arrowKeyTarget(
      key,
      current.element,
      list.map((item) => item.element),
      { orientation, rtl, loop: options.loop() },
    );
    return list.find((item) => item.element === element);
  }

  // The grid keys of a list whose items are in rows.
  function rowTarget(key: string, list: ListItem[], current: ListItem | null, rtl: boolean) {
    const rows: ListItem[][] = [];
    let row: Element | null | undefined;
    for (const item of list) {
      const around = item.element.closest('[role="row"]');
      if (around !== row || rows.length === 0) rows.push([item]);
      else rows[rows.length - 1]?.push(item);
      row = around;
    }
    const [forward, back] = rtl ? ['ArrowLeft', 'ArrowRight'] : ['ArrowRight', 'ArrowLeft'];
    if (!current) {
      if (key === 'ArrowDown') return list[0];
      if (key === 'ArrowUp') return list.at(-1);
      return undefined;
    }
    const rowIndex = rows.findIndex((each) => each.includes(current));
    const column = rows[rowIndex]?.indexOf(current) ?? 0;
    if (key === forward || key === back) {
      const step = key === forward ? 1 : -1;
      return (
        list[list.indexOf(current) + step] ??
        (options.loop() ? (step === 1 ? list[0] : list.at(-1)) : current)
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

  return {
    get highlighted() {
      return highlighted.value;
    },
    virtual: true,
    add(item) {
      added.push(item);
      return () => {
        const index = added.indexOf(item);
        if (index !== -1) added.splice(index, 1);
        if (highlighted.value === item) highlight(null, 'none');
      };
    },
    items,
    text: (item) => (item.label ?? item.element.textContent ?? '').trim(),
    highlight,
    moved,
    onKeydown(event) {
      if (event.ctrlKey || event.altKey || event.metaKey) return false;
      if (event.defaultPrevented || isComposing(event)) return false;
      const next = target(event.key, items());
      if (next === undefined) return false;
      event.preventDefault();
      highlight(next, 'keyboard', event);
      return true;
    },
  };
}

/** Adds the element to the list while it is mounted. Gives its highlight and its attributes. */
export function useListItem(
  list: List,
  element: Readonly<Ref<HTMLElement | null>>,
  item: { label(): string | undefined; disabled(): boolean },
): { highlighted: ComputedRef<boolean>; attributes: ComputedRef<Record<string, unknown>> } {
  watch(
    element,
    (el, _, onCleanup) => {
      if (!el) return;
      onCleanup(
        list.add({
          element: el,
          get label() {
            return item.label();
          },
          get disabled() {
            return item.disabled();
          },
        }),
      );
    },
    { flush: 'post' },
  );
  const highlighted = computed(
    () => !!element.value && list.highlighted?.element === element.value,
  );
  const attributes = computed(() => ({
    // A link or a button in the slot of an item is no tab stop of its own.
    tabindex: -1,
    'data-highlighted': highlighted.value ? '' : undefined,
  }));
  return { highlighted, attributes };
}
