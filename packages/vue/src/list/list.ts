import { computed, shallowReactive, shallowRef, watch, type ComputedRef, type Ref } from 'vue';
import { arrowKeyTarget } from '../common/arrowKeyTarget';
import { byDocumentOrder } from '../common/element';
import { ownerWindow } from '../common/owner';
import { isComposing } from '../popup/layer';

/** An item of a list, while its element is mounted. The properties are reactive. */
export interface ListItem {
  readonly element: HTMLElement;
  /** The `label` prop: the text of the typeahead. */
  readonly label: string | undefined;
  /** The item keeps the highlight, and its part does no action. */
  readonly disabled: boolean;
}

export type HighlightReason = 'keyboard' | 'pointer' | 'none';

/** What a list gives to its parts. The properties are reactive. */
export interface List {
  readonly highlighted: ListItem | null;
  add(item: ListItem): () => void;
  /**
   * The items that a key can reach, in the order of the document: in the document, shown and not
   * `:disabled`. With `hidden`, also the items that are not shown, such as those of a closed popup.
   */
  items(options?: { hidden?: boolean }): ListItem[];
  /** The `label` of the item, else its text, with no space at the ends. */
  text(item: ListItem): string;
  highlight(item: ListItem | null, reason: HighlightReason): void;
  /** The pointer moved: this `pointermove` does not have the position that the list knows. */
  moved(event: PointerEvent): boolean;
  /** A key of the list. Returns `true` when the list used the key and prevented its default. */
  onKeydown(event: KeyboardEvent): boolean;
  /** The listeners of the container element. */
  readonly listeners: Record<string, (event: never) => void>;
}

/**
 * A list of items that the arrow keys, Home, End and the pointer highlight. The highlighted item
 * has the focus.
 */
export function useList(options: {
  orientation(): 'vertical' | 'horizontal';
  loop(): boolean;
  /** Takes the focus when the highlight goes. */
  container(): HTMLElement | null;
  /** A pointer move highlights the item under the pointer. */
  hover?(): boolean;
}): List {
  const added = shallowReactive<ListItem[]>([]);
  const highlighted = shallowRef<ListItem | null>(null);
  // The position of the pointer, so that a list that opens or scrolls under a pointer that rests
  // highlights nothing (test/measurements/menu.test.ts).
  let known: { x: number; y: number } | null = null;
  let lastOver: { x: number; y: number } | null = null;

  const hover = () => options.hover?.() ?? true;

  function itemOf(target: EventTarget | null) {
    const container = options.container();
    for (let node = target as Element | null; node && node !== container; node = node.parentElement) {
      const item = added.find((each) => each.element === node);
      if (item) return item;
    }
    return undefined;
  }

  function items(itemOptions?: { hidden?: boolean }) {
    return added
      .filter(
        (item) =>
          item.element.isConnected &&
          !item.element.matches(':disabled') &&
          (itemOptions?.hidden || item.element.checkVisibility()),
      )
      .sort((a, b) => byDocumentOrder(a.element, b.element));
  }

  function highlight(item: ListItem | null, reason: HighlightReason) {
    const before = highlighted.value;
    highlighted.value = item;
    if (item) {
      item.element.focus({ preventScroll: true });
      // `focus()` alone puts the item in the middle of the list (test/measurements/menu.test.ts).
      // A pointer highlight does not move the list under the pointer.
      if (reason !== 'pointer') item.element.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      return;
    }
    const doc = before?.element.ownerDocument;
    if (before && doc && before.element.contains(doc.activeElement)) {
      options.container()?.focus({ preventScroll: true });
    }
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.defaultPrevented || event.ctrlKey || event.altKey || event.metaKey) return false;
    if (isComposing(event)) return false;
    const reachable = items();
    const current = highlighted.value;
    let next: ListItem | undefined;
    if (event.key === 'Home') next = reachable[0];
    else if (event.key === 'End') next = reachable.at(-1);
    else {
      const container = options.container();
      const vertical = options.orientation() === 'vertical';
      const rtl = !!container && ownerWindow(container).getComputedStyle(container).direction === 'rtl';
      const toEnd = vertical ? 'ArrowDown' : rtl ? 'ArrowLeft' : 'ArrowRight';
      const toStart = vertical ? 'ArrowUp' : rtl ? 'ArrowRight' : 'ArrowLeft';
      if (event.key !== toEnd && event.key !== toStart) return false;
      if (!current) {
        next = event.key === toEnd ? reachable[0] : reachable.at(-1);
      } else {
        const element = arrowKeyTarget(
          event.key,
          current.element,
          reachable.map((item) => item.element),
          { orientation: options.orientation(), rtl, loop: options.loop() },
        );
        next = reachable.find((item) => item.element === element) ?? current;
      }
    }
    event.preventDefault();
    if (next) highlight(next, 'keyboard');
    return true;
  }

  return {
    get highlighted() {
      return highlighted.value;
    },
    add(item) {
      added.push(item);
      return () => {
        added.splice(added.indexOf(item), 1);
        if (highlighted.value === item) highlighted.value = null;
      };
    },
    items,
    text(item) {
      return (item.label ?? item.element.textContent).trim();
    },
    highlight,
    moved(event) {
      return !known || known.x !== event.clientX || known.y !== event.clientY;
    },
    onKeydown,
    listeners: {
      onPointerover(event: PointerEvent) {
        const position = { x: event.clientX, y: event.clientY };
        // Content moved under a pointer that rests.
        if (lastOver && lastOver.x === position.x && lastOver.y === position.y) known = position;
        lastOver = position;
      },
      onPointermove(event: PointerEvent) {
        const moves = !known || known.x !== event.clientX || known.y !== event.clientY;
        known = { x: event.clientX, y: event.clientY };
        if (!moves || !hover() || event.pointerType === 'touch') return;
        const item = itemOf(event.target);
        if (item && item !== highlighted.value) highlight(item, 'pointer');
      },
      onPointerout(event: PointerEvent) {
        if (!hover() || !highlighted.value || itemOf(event.relatedTarget)) return;
        if (itemOf(event.target) === highlighted.value) highlight(null, 'pointer');
      },
      onPointerleave() {
        known = null;
        lastOver = null;
      },
      onFocusin(event: FocusEvent) {
        const item = itemOf(event.target);
        if (item && item !== highlighted.value) highlighted.value = item;
      },
    },
  };
}

/** Adds the element to the list while it is mounted. Gives the attributes of the item. */
export function useListItem(
  list: List,
  element: Readonly<Ref<HTMLElement | null>>,
  item: { label(): string | undefined; disabled(): boolean },
): {
  highlighted: ComputedRef<boolean>;
  attributes: ComputedRef<Record<string, unknown>>;
} {
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
    { flush: 'post', immediate: true },
  );
  const highlighted = computed(() => !!element.value && list.highlighted?.element === element.value);
  const attributes = computed(() => ({
    tabindex: highlighted.value ? 0 : -1,
    'data-highlighted': highlighted.value ? '' : undefined,
  }));
  return { highlighted, attributes };
}
