<script setup lang="ts">
import { mergeProps, onBeforeUnmount, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { usePointerPress } from '../common/pointerPress';
import { injectSlider, stateAttributes } from './root';
import type { SliderControlProps, SliderControlState } from './types';
import { largest, nearestThumb, snap } from './values';

/** A press, from its `pointerdown` to its end. */
interface Press {
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

defineOptions({ inheritAttrs: false });

defineProps<SliderControlProps>();

defineSlots<{
  default?(scope: { state: SliderControlState }): unknown;
  element?(scope: ElementSlotProps<SliderControlState>): unknown;
}>();

const slider = injectSlider('Control');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const pointer = usePointerPress({ start, move, end: (_, event) => slider.endPress(event) });

watch(
  () => slider.state.disabled,
  (disabled) => {
    if (disabled) pointer.cancel();
  },
);
watch(element, pointer.cancel);
onBeforeUnmount(pointer.cancel);

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      ...stateAttributes(slider.state),
      // The browser does not pan the page at a touch drag, and it ends no press with
      // `pointercancel`.
      style: { touchAction: 'none' },
      ...pointer.listeners,
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
  return snap(min + (fromStart / size) * (max - min), slider.state);
}

function start(event: PointerEvent) {
  const { values, orientation } = slider.state;
  const thumbs = slider.thumbs;
  const enabled = values.map((_, index) => !!thumbs[index] && !thumbs[index].disabled);
  const pressed = thumbs.find((thumb) => thumb?.element?.contains(event.target as Node));
  let index = pressed ? thumbs.indexOf(pressed) : -1;
  if (pressed ? !enabled[index] : !enabled.includes(true)) return undefined;
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
    index,
    offset,
    vertical,
    rtl: slider.readDirection(control),
    start: inset(vertical ? 'bottom' : 'inline-start'),
    end: inset(vertical ? 'top' : 'inline-end'),
    half: slider.edge && sized ? (vertical ? sized.offsetHeight : sized.offsetWidth) / 2 : 0,
  };
  // The browser gives the focus to no other element and selects no text. A touch gives no
  // `mousedown` after its end.
  event.preventDefault();
  slider.startPress();
  const target = index === -1 ? valueAt(event, control, current) : undefined;
  if (target !== undefined) {
    current.index = slider.dragTo(
      nearestThumb(values, target, enabled),
      target,
      'track-press',
      event,
    );
  }
  focus(current.index);
  return current;
}

function move(press: Press, event: PointerEvent) {
  const target = valueAt(event, event.currentTarget as Element, press);
  if (target === undefined) return;
  const index = slider.dragTo(press.index, target, 'drag', event);
  if (index === press.index) return;
  press.index = index;
  if (!slider.thumbs[index]?.element) press.offset = 0;
  focus(index);
}

function focus(index: number) {
  slider.thumbs[index]?.input?.focus({ preventScroll: true, focusVisible: false });
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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="slider.state" />
  </div>
</template>
