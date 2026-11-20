<script setup lang="ts">
import { mergeProps, onBeforeUnmount, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { injectNumberFieldRoot, stateAttributes } from './root';
import type { NumberFieldScrubAreaProps, NumberFieldScrubAreaState } from './types';

interface Scrub {
  readonly pointerId: number;
  readonly start: number | null;
  /** The end of the line is to the left. */
  readonly rtl: boolean;
  x: number;
  y: number;
  /** The distance on the axis that no step used yet. */
  distance: number;
}

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldScrubAreaProps>(), {
  orientation: 'horizontal',
  pixelSensitivity: 2,
});
defineSlots<{
  default?(scope: { state: NumberFieldScrubAreaState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: NumberFieldScrubAreaState;
  }): unknown;
}>();

const root = injectNumberFieldRoot('ScrubArea');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
let scrub: Scrub | undefined;

// A scrub ends with no commit when the field becomes disabled or read-only.
watch(
  () => root.state.disabled || root.state.readonly,
  (off) => off && end(),
);
onBeforeUnmount(() => end());

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'presentation',
      style: { userSelect: 'none', WebkitUserSelect: 'none' },
      ...stateAttributes(root.state),
      onPointerdown,
      onTouchstart,
    },
    attrs,
  );
}

function onPointerdown(event: PointerEvent) {
  const { state } = root;
  if (event.button !== 0 || state.disabled || state.readonly) return;
  if (event.pointerType === 'mouse') {
    // The focus stays in the text input, and a label in the area still gets its click (measured).
    event.preventDefault();
    root.focusInput();
  }
  end();
  scrub = {
    pointerId: event.pointerId,
    start: state.value,
    rtl: getComputedStyle(event.currentTarget as Element).direction === 'rtl',
    x: event.clientX,
    y: event.clientY,
    distance: 0,
  };
  root.setScrubbing(true);
  window.addEventListener('pointermove', onMove);
  // An ancestor can stop `pointerup` before it gets to the area (measured).
  window.addEventListener('pointerup', onRelease, true);
  window.addEventListener('pointercancel', onCancel, true);
}

// `touch-action` does not apply to an inline element, so the area cancels the touch to keep the
// page still. Two fingers still zoom (measured).
function onTouchstart(event: TouchEvent) {
  const { state } = root;
  if (event.touches.length === 1 && !state.disabled && !state.readonly) event.preventDefault();
}

function onMove(event: PointerEvent) {
  const current = scrub;
  if (!current || event.pointerId !== current.pointerId) return;
  // A move toward the end of the line, or up, steps up.
  const moveX = event.clientX - current.x;
  current.distance +=
    props.orientation === 'horizontal'
      ? current.rtl
        ? -moveX
        : moveX
      : current.y - event.clientY;
  current.x = event.clientX;
  current.y = event.clientY;
  const size = props.pixelSensitivity > 0 ? props.pixelSensitivity : 1;
  const steps = Math.trunc(current.distance / size);
  if (steps === 0) return;
  current.distance -= steps * size;
  root.step(steps > 0 ? 1 : -1, event, 'scrub', event, Math.abs(steps));
}

function onRelease(event: PointerEvent) {
  if (event.pointerId === scrub?.pointerId) end(event);
}

function onCancel(event: PointerEvent) {
  if (event.pointerId === scrub?.pointerId) end();
}

/** Ends the scrub, with a commit when `release` is the event of a release. */
function end(release?: PointerEvent) {
  const current = scrub;
  if (!current) return;
  scrub = undefined;
  window.removeEventListener('pointermove', onMove);
  window.removeEventListener('pointerup', onRelease, true);
  window.removeEventListener('pointercancel', onCancel, true);
  root.setScrubbing(false);
  const { value } = root.state;
  if (release && value !== current.start) root.commit(value, 'scrub', release);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="root.state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </component>
  <span v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="root.state" />
  </span>
</template>
