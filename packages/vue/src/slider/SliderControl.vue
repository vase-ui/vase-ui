<script setup lang="ts">
import { mergeProps, onBeforeUnmount, useAttrs, watch } from 'vue';
import type { HTMLAttributes } from 'vue';
import { useElement } from '../common/element';
import { injectSlider, stateAttributes } from './root';
import type { SliderControlState } from './types';
import { largest, nearestThumb, snap } from './values';

/** A press, from its `pointerdown` to its end. */
interface Press {
  pointerId: number;
  /** The thumb that the press moves. */
  index: number;
  /** The distance on the axis from the centre of the pressed thumb to the pointer. */
  offset: number;
  vertical: boolean;
  rtl: boolean;
  /** The border and the padding of the control at the start and at the end of the axis. */
  start: number;
  end: number;
  /** Half the size of a thumb, for `edge`. */
  half: number;
}

// The part takes the attributes of its element.
interface Attributes extends /* @vue-ignore */ HTMLAttributes {}

defineOptions({ inheritAttrs: false });

defineProps<Attributes>();

defineSlots<{
  default?(scope: { state: SliderControlState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SliderControlState;
  }): unknown;
}>();

const slider = injectSlider('Control');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
let press: Press | undefined;

watch(
  () => slider.state.disabled,
  (disabled) => {
    if (disabled) cancel(element.value);
  },
);
watch(element, (_, old) => cancel(old));
onBeforeUnmount(() => cancel(element.value));

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      ...stateAttributes(slider.state),
      // The browser does not pan the page at a touch drag, and it ends no press with
      // `pointercancel`.
      style: { touchAction: 'none' },
      onPointerdown,
      onPointermove,
      onPointerup: end,
      onPointercancel: end,
    },
    attrs,
  );
}

/** The value of the grid under the pointer, or `undefined` when the control has no room. */
function valueAt(event: PointerEvent, control: Element, current: Press) {
  const rect = control.getBoundingClientRect();
  const { vertical, rtl, start, end, half, offset } = current;
  const size = (vertical ? rect.height : rect.width) - start - end - 2 * half;
  if (size <= 0) return undefined;
  const point = (vertical ? event.clientY : event.clientX) - offset;
  // The value area starts at the bottom of a vertical slider, and at the right in right-to-left.
  const fromStart = vertical
    ? rect.bottom - start - half - point
    : rtl
      ? rect.right - start - half - point
      : point - rect.left - start - half;
  const { min, max } = slider.state;
  return snap(min + Math.min(Math.max(fromStart / size, 0), 1) * (max - min), slider.state);
}

function onPointerdown(event: PointerEvent) {
  const { values, disabled, orientation } = slider.state;
  if (press || disabled || event.button !== 0) return;
  const thumbs = slider.thumbs;
  const enabled = values.map((_, index) => !!thumbs[index] && !thumbs[index].disabled);
  const pressed = thumbs.find((thumb) => thumb?.element?.contains(event.target as Node));
  let index = pressed ? thumbs.indexOf(pressed) : -1;
  if (pressed ? !enabled[index] : !enabled.includes(true)) return;
  const control = event.currentTarget as HTMLElement;
  const vertical = orientation === 'vertical';
  const style = getComputedStyle(control);
  const inset = (side: string) =>
    (parseFloat(style.getPropertyValue(`border-${side}-width`)) || 0) +
    (parseFloat(style.getPropertyValue(`padding-${side}`)) || 0);
  let offset = 0;
  if (pressed?.element) {
    // Of thumbs together at the largest value, only the first one can move down.
    if (values[index] === largest(slider.state)) {
      index = values.findIndex((other, at) => enabled[at] && other === values[index]);
    }
    const rect = pressed.element.getBoundingClientRect();
    offset = vertical
      ? event.clientY - (rect.top + rect.height / 2)
      : event.clientX - (rect.left + rect.width / 2);
  }
  const sized = (pressed ?? thumbs.find((thumb) => thumb?.element))?.element;
  const current: Press = {
    pointerId: event.pointerId,
    index,
    offset,
    vertical,
    rtl: slider.readDirection(control),
    start: inset(vertical ? 'bottom' : 'inline-start'),
    end: inset(vertical ? 'top' : 'inline-end'),
    half: slider.edge && sized ? (vertical ? sized.offsetHeight : sized.offsetWidth) / 2 : 0,
  };
  // The control gets each move and the end of the pointer, anywhere.
  control.setPointerCapture(event.pointerId);
  // The browser then gives the focus to no other element and selects no text. A touch gives no
  // `mousedown` after its end.
  event.preventDefault();
  press = current;
  slider.startPress();
  if (index === -1) {
    const target = valueAt(event, control, current);
    if (target === undefined) {
      current.index = enabled.indexOf(true);
    } else {
      current.index = slider.dragTo(
        nearestThumb(values, target, enabled),
        target,
        'track-press',
        event,
      );
    }
  }
  focus(current.index);
}

function onPointermove(event: PointerEvent) {
  if (!press || event.pointerId !== press.pointerId) return;
  // Firefox gives the page no `pointerup` for a release outside its view. The next move has no
  // button down.
  if (event.buttons === 0) {
    end(event);
    return;
  }
  const target = valueAt(event, event.currentTarget as Element, press);
  if (target === undefined) return;
  const index = slider.dragTo(press.index, target, 'drag', event);
  if (index === press.index) return;
  press.index = index;
  if (!slider.thumbs[index]?.element) press.offset = 0;
  focus(index);
}

function end(event: PointerEvent) {
  if (!press || event.pointerId !== press.pointerId) return;
  press = undefined;
  slider.endPress(event);
}

/** Ends the press with no commit. */
function cancel(control: HTMLElement | null | undefined) {
  if (!press) return;
  if (control?.hasPointerCapture(press.pointerId)) control.releasePointerCapture(press.pointerId);
  press = undefined;
  slider.endPress();
}

function focus(index: number) {
  slider.thumbs[index]?.input?.focus({ preventScroll: true });
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="slider.state"
  />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" />
  </div>
</template>
