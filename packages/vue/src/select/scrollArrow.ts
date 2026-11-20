import { computed, onUnmounted, type Ref } from 'vue';
import { useEnterAfterLeave } from '../common/useEnterAfterLeave';
import { useTimeout } from '../common/useTimeout';
import { getMaxScrollOffset, normalizeScrollOffset } from '../utils/scrollEdges';
import { injectSelectPositioner, injectSelectRoot, type SelectContext } from './root';
import type { SelectScrollArrowState } from './types';

// The arrow scrolls one item each 40 ms (Base UI).
const STEP = 40;

/**
 * The scroll of the list to show the next item past the arrow. An item counts as shown when the
 * arrow covers 1 px or less of it.
 */
function nextScrollTop(
  context: SelectContext,
  scroller: HTMLElement,
  direction: 'up' | 'down',
  arrowHeight: number,
) {
  const box = scroller.getBoundingClientRect();
  const offset = box.top + scroller.clientTop - scroller.scrollTop;
  const rows = context.list.items().map((item) => {
    const rect = item.element.getBoundingClientRect();
    return { top: rect.top - offset, bottom: rect.bottom - offset };
  });
  const max = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
  const top = scroller.scrollTop;
  if (direction === 'up') {
    const edge = top + arrowHeight - 1;
    const first = rows.findIndex((row) => row.top >= edge);
    const row = rows[first - 1];
    return row ? normalizeScrollOffset(row.top - arrowHeight, max) : 0;
  }
  const edge = top + scroller.clientHeight - arrowHeight + 1;
  const past = rows.findIndex((row) => row.bottom > edge);
  const row = past === -1 ? undefined : rows[past];
  return row ? normalizeScrollOffset(row.bottom - scroller.clientHeight + arrowHeight, max) : max;
}

/** A scroll arrow: it shows while the list can scroll in its direction, and a hover scrolls. */
export function useScrollArrow(
  direction: 'up' | 'down',
  element: Readonly<Ref<HTMLElement | null>>,
  keepMounted: () => boolean,
) {
  const part = direction === 'up' ? 'ScrollUpArrow' : 'ScrollDownArrow';
  const context = injectSelectRoot(part);
  const placement = injectSelectPositioner(part);
  const timer = useTimeout();
  let position: { x: number; y: number } | null = null;

  context.arrows.value += 1;
  onUnmounted(() => (context.arrows.value -= 1));

  // A hover scrolls, so a touch open shows no arrow.
  const visible = computed(
    () =>
      context.root.open &&
      context.scrollable.value[direction] &&
      context.root.interaction !== 'touch',
  );
  const { waiting } = useEnterAfterLeave(() => visible.value, element);
  const state = computed<SelectScrollArrowState>(() => ({
    direction,
    visible: visible.value,
    side: placement.side.value,
  }));

  function step() {
    const scroller = context.container();
    if (!scroller) return;
    context.list.highlight(null, 'pointer');
    const max = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
    const top = normalizeScrollOffset(scroller.scrollTop, max);
    if (top === (direction === 'up' ? 0 : max)) {
      scroller.scrollTop = top;
      return;
    }
    scroller.scrollTop = nextScrollTop(
      context,
      scroller,
      direction,
      element.value?.offsetHeight ?? 0,
    );
    timer.start(STEP, step);
  }

  return {
    state,
    rendered: computed(() => (visible.value && !waiting.value) || keepMounted()),
    listeners: {
      onPointerover(event: PointerEvent) {
        position = { x: event.clientX, y: event.clientY };
      },
      // An arrow that appears under a pointer that rests gets a `pointermove` with no move in
      // WebKit (test/measurements/select.test.ts).
      onPointermove(event: PointerEvent) {
        const moved = !!position && (position.x !== event.clientX || position.y !== event.clientY);
        position = { x: event.clientX, y: event.clientY };
        if (!moved || timer.isStarted() || !visible.value) return;
        context.list.highlight(null, 'pointer');
        timer.start(STEP, step);
      },
      onPointerleave() {
        position = null;
        timer.clear();
      },
    },
  };
}
