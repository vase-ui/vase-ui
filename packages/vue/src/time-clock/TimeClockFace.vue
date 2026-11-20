<script setup lang="ts">
import { computed, mergeProps, nextTick, onBeforeUnmount, shallowRef, useAttrs } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement } from '../common/element';
import { formatNumber } from '../common/formatNumber';
import { visuallyHiddenInput } from '../common/visuallyHidden';
import { clockAttributes, injectClock } from './clock';
import type { TimeClockFaceProps, TimeClockFaceState } from './types';
import {
  angleOfPoint,
  faceNumber,
  faceNumberOfPoint,
  outerRingRadius,
  pagePlaces,
  ratioOfPoint,
  type TimeClockFaceNumber,
} from './views';

defineOptions({ inheritAttrs: false });

const props = defineProps<TimeClockFaceProps>();
defineSlots<{
  default?(scope: { state: TimeClockFaceState }): unknown;
  /** Renders one number of the face. The face has no numbers without it. */
  number?(scope: { number: TimeClockFaceNumber; index: number }): unknown;
}>();

// The range input has the box of the face, so the focus ring of a screen reader fits the face. The
// face handles each press, so the input takes no pointer.
const INPUT_STYLE = {
  ...visuallyHiddenInput,
  inset: 0,
  margin: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
};

const attrs = useAttrs();
const clock = injectClock();
const { element, setElement } = useElement<HTMLElement>();
const inputElement = shallowRef<HTMLInputElement | null>(null);
const state = computed<TimeClockFaceState>(() => clock.state);
// The pointer of the press, the radius of the outer ring at the press, and whether the press
// selected a number.
let pointerId: number | null = null;
let radius = 0;
let selected = false;

// The attributes of the range input: the `id` and each ARIA attribute of the developer, and the
// rest for the face.
const inputAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([name]) => name === 'id' || name.startsWith('aria-')),
  ),
);
const faceAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(([name]) => name !== 'id' && !name.startsWith('aria-')),
  ),
);

function valueText() {
  const { selectedNumber, view } = clock;
  return (
    props.getAriaValueText?.(selectedNumber.value, view) ??
    formatNumber(selectedNumber.value, clock.locale, {
      style: 'unit',
      unit: view,
      unitDisplay: 'long',
    })
  );
}

function inputProps() {
  const { grid, view, state: current } = clock;
  const named = 'aria-label' in inputAttrs.value || 'aria-labelledby' in inputAttrs.value;
  return mergeProps(
    {
      type: 'range',
      min: grid.first,
      max: grid.first + grid.count - 1,
      step: grid.step,
      value: clock.selectedNumber.value,
      disabled: current.disabled,
      'aria-label': named
        ? undefined
        : new Intl.DisplayNames(clock.locale, { type: 'dateTimeField' }).of(view),
      'aria-valuetext': valueText(),
      'aria-readonly': current.readonly ? 'true' : undefined,
      style: INPUT_STYLE,
      onInput,
    },
    inputAttrs.value,
  );
}

function setInput(target: unknown) {
  inputElement.value = target as HTMLInputElement | null;
  clock.setRangeInput(inputElement.value);
}

function onInput(event: Event) {
  const input = event.currentTarget as HTMLInputElement;
  clock.selectNumber(
    faceNumber(clock.view, clock.hourCycle, input.valueAsNumber),
    createChangeEventDetails('input-change', event),
  );
  // The input shows the value of the clock again after a change that the clock did not take.
  nextTick(() => {
    const shown = String(clock.selectedNumber.value);
    if (input.value !== shown) input.value = shown;
  });
}

function selectAt(event: PointerEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const point = { x: event.clientX, y: event.clientY };
  const number = faceNumberOfPoint(
    clock.view,
    clock.hourCycle,
    clock.grid.step,
    angleOfPoint(point, rect),
    ratioOfPoint(point, rect, radius),
  );
  if (clock.selectNumber(number, createChangeEventDetails('drag', event))) selected = true;
}

function endPress() {
  if (pointerId === null) return;
  pointerId = null;
  clock.setDragging(false);
}

function onPointerdown(event: PointerEvent) {
  const { disabled, readonly } = clock.state;
  if (event.button !== 0 || disabled || readonly || pointerId !== null) return;
  const face = event.currentTarget as HTMLElement;
  pointerId = event.pointerId;
  // The style sheet of the developer places the numbers, so the press measures the outer ring.
  radius = outerRingRadius(
    face.getBoundingClientRect(),
    clock.outerNumbers.map((number) => number.getBoundingClientRect()),
  );
  selected = false;
  // `setPointerCapture` throws for the pointer of an event that a script made.
  if (event.isTrusted) face.setPointerCapture(event.pointerId);
  clock.setDragging(true);
  // The browser would move the focus and select text.
  event.preventDefault();
  inputElement.value?.focus({ preventScroll: true });
  selectAt(event);
}

function onPointermove(event: PointerEvent) {
  if (event.pointerId === pointerId) selectAt(event);
}

function onPointerup(event: PointerEvent) {
  if (event.pointerId !== pointerId) return;
  endPress();
  if (selected) clock.commit({ reason: 'drag', event });
}

function onPointercancel(event: PointerEvent) {
  if (event.pointerId === pointerId) endPress();
}

// The browsers differ in the keys of a range input: the size of a page, the wrap, the direction and
// Enter (test/measurements/time-clock.test.ts). The face handles each key itself.
function onKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    event.target !== inputElement.value ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey
  ) {
    return;
  }
  const details = () => createChangeEventDetails('keyboard', event);
  const page = pagePlaces(clock.view, clock.grid.step);
  switch (event.key) {
    case 'ArrowRight':
    case 'ArrowUp':
      clock.stepNumber(1, details());
      break;
    case 'ArrowLeft':
    case 'ArrowDown':
      clock.stepNumber(-1, details());
      break;
    case 'PageUp':
      clock.stepNumber(page, details());
      break;
    case 'PageDown':
      clock.stepNumber(-page, details());
      break;
    case 'Home':
      clock.selectEdge('first', details());
      break;
    case 'End':
      clock.selectEdge('last', details());
      break;
    case 'Enter':
    case ' ':
      clock.commit({ reason: 'keyboard', event });
      break;
    default:
      return;
  }
  event.preventDefault();
}

// No event of the pointer reaches a face that goes away.
onBeforeUnmount(endPress);

defineExpose({ element, inputElement });

function elementProps() {
  return mergeProps(
    {
      ...clockAttributes(clock.state),
      style: { touchAction: 'none' },
      onKeydown,
      onPointerdown,
      onPointermove,
      onPointerup,
      onPointercancel,
      onLostpointercapture: onPointercancel,
    },
    faceAttrs.value,
  );
}
</script>

<template>
  <div v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <template v-if="$slots.number">
      <template v-for="(number, index) in clock.numbers" :key="number.value">
        <slot name="number" :number="number" :index="index" />
      </template>
    </template>
    <input v-bind="inputProps()" :ref="setInput" />
  </div>
</template>
