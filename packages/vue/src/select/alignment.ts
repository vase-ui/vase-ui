import { addEventListener } from '../common/addEventListener';
import { clamp } from '../common/clamp';
import { ownerDocument, ownerWindow } from '../common/owner';
import { platform } from '../common/platform';
import { platform as floatingPlatform } from '@floating-ui/vue';
import { computed, nextTick, shallowRef, watch, type CSSProperties } from 'vue';
import {
  getMaxScrollOffset,
  normalizeScrollOffset,
  SCROLL_EDGE_TOLERANCE_PX,
} from '../common/scrollEdges';
import type { SelectContext } from './root';

export interface Box {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

// The defaults of the margin and the `min-height` of the positioner, and the room that the trigger
// needs at the top and the bottom of the view.
const MARGIN = 10;
const MIN_HEIGHT = 100;
const VIEW_PADDING = 5;
const TRIGGER_ROOM = 20;

export interface AlignedPlace {
  left: number;
  height: number;
  /** The scroll of the list that puts the text of the item over the text of the value. */
  scrollTop: number;
  /** The height that the popup needs below the top of the view to align its item. */
  idealHeight: number;
  /** The height of the view inside the margins of the positioner. */
  room: number;
  /** The sum of the top and the bottom margins of the positioner. */
  margins: number;
  transformOrigin: string | undefined;
}

/**
 * The first place of a popup that covers the trigger: the text of the item over the text of the
 * value, with the same vertical middle and the same inline start (the inline end in a right-to-left
 * popup). With no text, the popup starts at the inline start of the trigger.
 */
export function alignedPlace(input: {
  trigger: Box;
  positioner: Box;
  value: Box | undefined;
  text: Box | undefined;
  view: { width: number; height: number };
  margin: { top: number; bottom: number };
  borderBottom: number;
  rtl: boolean;
}): AlignedPlace {
  const { trigger, positioner, value, text, view, margin, rtl } = input;
  const room = view.height - margin.top - margin.bottom;
  let left = rtl ? trigger.right - positioner.width : trigger.left;
  let offsetY = 0;
  if (text && value) {
    left = positioner.left + (rtl ? value.right - text.right : value.left - text.left);
    offsetY =
      text.top - positioner.top + text.height / 2 - (value.top - trigger.top + value.height / 2);
  }
  const idealHeight = room - trigger.top + offsetY + margin.bottom + input.borderBottom;
  const height = Math.min(room, idealHeight);
  const origin =
    positioner.height > 0
      ? ((text?.top ?? 0) + (text?.height ?? 0) / 2 - positioner.top) / positioner.height
      : 0.5;
  return {
    left: clamp(left, VIEW_PADDING, view.width - VIEW_PADDING - positioner.width),
    height,
    scrollTop: idealHeight - height,
    idealHeight,
    room,
    margins: margin.top + margin.bottom,
    transformOrigin: text ? `50% ${clamp(origin * 100, 0, 100)}%` : undefined,
  };
}

export interface PinnedPlace {
  height: number;
  /** The popup is pinned to the top of the view, else to the bottom. */
  top: number | undefined;
  /** The scroll of the list: `max` is the end. */
  scrollTop: number | 'max';
  /** The edge from which the popup grows when the user scrolls the list. */
  pinned: 'top' | 'bottom' | null;
  /** The popup has its full height. */
  full: boolean;
}

/**
 * Pins the popup to the top or the bottom of the view, after the list has the height of
 * `alignedPlace`. `null`: the popup goes to the anchored place, because the trigger is near an edge
 * of the view or the height is less than the content and the `min-height`.
 */
export function pinnedPlace(input: {
  place: AlignedPlace;
  trigger: Box;
  /** The height of the positioner before `alignedPlace`. */
  positionerHeight: number;
  maxScrollTop: number;
  scrollHeight: number;
  minHeight: number;
  maxHeight: number;
}): PinnedPlace | null {
  const { place, trigger, positionerHeight, maxScrollTop } = input;
  const atEnd = place.scrollTop >= maxScrollTop - SCROLL_EDGE_TOLERANCE_PX;
  const height = atEnd
    ? Math.min(place.room, positionerHeight) - (place.scrollTop - maxScrollTop)
    : place.height;
  if (
    trigger.top < TRIGGER_ROOM ||
    trigger.bottom > place.room - TRIGGER_ROOM ||
    Math.ceil(height) + SCROLL_EDGE_TOLERANCE_PX < Math.min(input.scrollHeight, input.minHeight)
  ) {
    return null;
  }
  const top =
    positionerHeight >= place.room - place.margins
      ? 0
      : Math.max(0, place.room - place.idealHeight);
  return {
    height,
    top: atEnd ? top : undefined,
    scrollTop: atEnd ? 'max' : place.scrollTop,
    pinned: atEnd ? (top === 0 ? 'top' : null) : 'bottom',
    full: Math.max(input.minHeight, height) === place.room || height >= input.maxHeight,
  };
}

/**
 * The popup grows toward its free edge when the user scrolls the list, until it has the full room
 * or its `max-height`. The list then keeps the scroll at the edge, so new rows come by the growth.
 */
export function grownPlace(input: {
  height: number;
  room: number;
  maxHeight: number;
  pinned: 'top' | 'bottom';
  scrollTop: number;
  maxScrollTop: number;
}): { height: number | undefined; scrollTop: number | 'max' | undefined; full: boolean } {
  const { height, scrollTop, maxScrollTop, pinned } = input;
  const available = Math.min(input.room, input.maxHeight);
  const toEdge = pinned === 'top' ? 'max' : 0;
  const diff = pinned === 'top' ? maxScrollTop - scrollTop : scrollTop;
  if (diff <= SCROLL_EDGE_TOLERANCE_PX) {
    const grow = clamp(diff, 0, available - height);
    return {
      height: grow > 0 ? height + grow : undefined,
      scrollTop: toEdge,
      full: available - (height + grow) <= SCROLL_EDGE_TOLERANCE_PX,
    };
  }
  const next = Math.min(height + diff, available);
  let target: number | 'max' | undefined;
  if (available - next > SCROLL_EDGE_TOLERANCE_PX) target = toEdge;
  else if (pinned === 'bottom' && scrollTop < maxScrollTop) {
    target = scrollTop - (diff - (height + diff - available));
  }
  const rounded = Math.ceil(next);
  return {
    height: rounded === 0 ? undefined : rounded,
    scrollTop: target,
    full: rounded >= available - SCROLL_EDGE_TOLERANCE_PX,
  };
}

/** The rectangle of the element in the pixels of the styles of the positioner. */
function boxOf(element: Element, scale: { x: number; y: number }): Box {
  const { top, left, right, bottom, width, height } = element.getBoundingClientRect();
  return {
    top: top / scale.y,
    left: left / scale.x,
    right: right / scale.x,
    bottom: bottom / scale.y,
    width: width / scale.x,
    height: height / scale.y,
  };
}

/** A `px` value of a style, else the default: an unset value and `0` give it. */
function pixels(value: string, fallback: number) {
  return Number.parseFloat(value) || fallback;
}

// A `transform` of an enter class makes the rectangles smaller than the place of the popup
// (test/measurements/select.test.ts), so the read sets the transforms off.
const TRANSFORMS = [
  ['transform', 'none'],
  ['scale', '1'],
  ['translate', '0 0'],
] as const;

function readWithoutTransforms<T>(element: HTMLElement, read: () => T): T {
  const { style } = element;
  const saved = TRANSFORMS.map(
    ([property]) =>
      [property, style.getPropertyValue(property), style.getPropertyPriority(property)] as const,
  );
  for (const [property, value] of TRANSFORMS) style.setProperty(property, value, 'important');
  try {
    return read();
  } finally {
    for (const [property, value, priority] of saved) {
      if (value) style.setProperty(property, value, priority);
      else style.removeProperty(property);
    }
  }
}

/** Scrolls `scroller` to `top`, where `max` is the end. */
function scrollTo(scroller: HTMLElement, top: number | 'max') {
  const max = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
  scroller.scrollTop = top === 'max' ? max : clamp(top, 0, max);
}

/** The list can scroll up and down: a distance of 1 px or less counts as none. */
export function scrollEdges(scroller: HTMLElement) {
  const max = getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight);
  const top = normalizeScrollOffset(scroller.scrollTop, max);
  return { up: top > 0, down: top < max };
}

/**
 * Places the popup over the trigger, as a native select of macOS does, for each open that is not a
 * touch open, while `alignItemWithTrigger` is true and the view has the room.
 */
export function useItemAlignment(
  context: SelectContext,
  options: {
    enabled: () => boolean;
    popupShown: () => boolean;
    /** Floating UI gave the variables of this open, such as `--anchor-width`. */
    anchored: () => boolean;
  },
) {
  const { root, aligned } = context;
  const place = shallowRef<CSSProperties | null>(null);
  let pinned: 'top' | 'bottom' | null = null;
  let full = true;
  let margins = 0;
  let height = 0;
  let maxHeight = Infinity;
  let run = 0;

  watch(
    () => root.open,
    (open) => {
      if (!open) return;
      run += 1;
      aligned.value = options.enabled() && root.interaction !== 'touch';
      place.value = null;
      pinned = null;
      full = true;
    },
    { flush: 'sync', immediate: true },
  );

  watch(
    () =>
      root.open && aligned.value && options.popupShown() && options.anchored()
        ? context.positioner.value
        : null,
    async (positioner) => {
      const current = run;
      // The popup shows in the render that this change queues.
      await nextTick();
      const popup = root.popup;
      const trigger = root.activeTrigger;
      const scroller = context.container();
      if (!positioner || !popup || !trigger || !scroller || place.value || current !== run) return;
      const win = ownerWindow(positioner);
      const view = ownerDocument(positioner).documentElement;
      const styles = win.getComputedStyle(positioner);
      const popupStyles = win.getComputedStyle(popup);
      const margin = {
        top: pixels(styles.marginTop, MARGIN),
        bottom: pixels(styles.marginBottom, MARGIN),
      };
      const item =
        context.selectedItem() ?? (context.hasValue ? undefined : context.list.items()[0]);
      const text = item && context.itemTexts.get(item.element);
      // A `zoom` of the page scales the rectangles and not the styles (test/popupLayout.test.tsx).
      const scale = floatingPlatform.getScale(positioner) as { x: number; y: number };
      const read = readWithoutTransforms(popup, () => ({
        trigger: boxOf(trigger, scale),
        positioner: boxOf(positioner, scale),
        value: context.valueElement.value ? boxOf(context.valueElement.value, scale) : undefined,
        text: text?.isConnected ? boxOf(text, scale) : undefined,
        scrollHeight: scroller.scrollHeight,
      }));
      const first = alignedPlace({
        ...read,
        view: { width: view.clientWidth, height: view.clientHeight },
        margin,
        borderBottom: Number.parseFloat(popupStyles.borderBottomWidth) || 0,
        rtl: styles.direction === 'rtl',
      });
      const style: CSSProperties = {
        left: `${first.left}px`,
        height: `${first.height}px`,
        maxHeight: 'none',
        marginTop: `${margin.top}px`,
        marginBottom: `${margin.bottom}px`,
        '--transform-origin': first.transformOrigin,
      };
      place.value = { ...style, visibility: 'hidden' };
      await nextTick();
      if (current !== run || !root.open) return;
      maxHeight = popupStyles.maxHeight.endsWith('px')
        ? pixels(popupStyles.maxHeight, Infinity)
        : Infinity;
      const pin = pinnedPlace({
        place: first,
        trigger: read.trigger,
        positionerHeight: read.positioner.height,
        maxScrollTop: getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight),
        scrollHeight: read.scrollHeight,
        minHeight: pixels(styles.minHeight, MIN_HEIGHT),
        maxHeight,
      });
      // WebKit places the popup wrong under a pinch zoom (Base UI).
      if (!pin || ((win.visualViewport?.scale ?? 1) !== 1 && platform.engine.webkit)) {
        aligned.value = false;
        return;
      }
      ({ pinned, full } = pin);
      margins = first.margins;
      height = pin.height;
      place.value = {
        ...style,
        height: `${pin.height}px`,
        ...(pin.top === undefined ? { bottom: '0' } : { top: `${pin.top}px` }),
      };
      await nextTick();
      if (current !== run || !root.open) return;
      scrollTo(scroller, pin.scrollTop);
      context.scrollable.value = scrollEdges(scroller);
    },
    { flush: 'post' },
  );

  watch(
    () => (root.open && aligned.value ? context.positioner.value : null),
    (positioner, _, onCleanup) => {
      if (!positioner) return;
      onCleanup(
        addEventListener(ownerWindow(positioner), 'resize', (event) =>
          root.request(false, 'window-resize', event),
        ),
      );
    },
  );

  return {
    /** The place for `usePlacement`: none while the popup is anchored. */
    place: computed(() => (aligned.value ? place.value : undefined)),
    /** The popup that covers the trigger has its height and its scroll. */
    ready: computed(() => !aligned.value || (!!place.value && place.value.visibility !== 'hidden')),
    /** The list scrolled. */
    onScroll(scroller: HTMLElement) {
      if (aligned.value && pinned && !full && place.value?.visibility !== 'hidden') {
        const grown = grownPlace({
          height,
          room: ownerDocument(scroller).documentElement.clientHeight - margins,
          maxHeight,
          pinned,
          scrollTop: scroller.scrollTop,
          maxScrollTop: getMaxScrollOffset(scroller.scrollHeight, scroller.clientHeight),
        });
        full = grown.full;
        if (grown.height !== undefined) {
          height = grown.height;
          place.value = { ...place.value, height: `${grown.height}px` };
        }
        const target = grown.scrollTop;
        if (target !== undefined) void nextTick(() => scrollTo(scroller, target));
      }
      context.scrollable.value = scrollEdges(scroller);
    },
  };
}
