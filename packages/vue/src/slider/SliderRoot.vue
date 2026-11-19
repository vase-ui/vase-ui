<script setup lang="ts" generic="Value extends number | readonly number[] = number">
// With no `modelValue` and no `defaultValue`, the value is `min`, so the default of `Value` is
// `number`.
import {
  computed,
  inject,
  mergeProps,
  nextTick,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { byDocumentOrder, useElement } from '../common/element';
import { useModel } from '../common/model';
import { warn } from '../common/warn';
import { fieldKey } from '../field/control';
import { fieldsetKey, useInDisabledFieldset } from '../fieldset/part';
import { sliderKey, stateAttributes, type SliderThumbEntry } from './root';
import type {
  SliderRootChangeEventDetails,
  SliderRootChangeEventReason,
  SliderRootCommitEventDetails,
  SliderRootProps,
  SliderRootState,
} from './types';
import { dragThumb, moveThumb, sameValues, shownValues } from './values';

type Emitted = Value extends number ? number : Value;

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderRootProps<Value>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  min: 0,
  max: 100,
  step: 1,
  largeStep: 10,
  minStepsBetweenValues: 0,
  thumbCollisionBehavior: 'push',
  thumbAlignment: 'center',
  orientation: 'horizontal',
  locale: 'en-US',
});
const emit = defineEmits<{
  /** The user changes the value, also at each move of a drag. `details.cancel()` keeps the value. */
  valueChange: [value: Emitted, details: SliderRootChangeEventDetails];
  /** Comes after the change event, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Emitted];
  /** The user ends an action that changed the value: a key, an `input` event, or a press. */
  valueCommitted: [value: Emitted, details: SliderRootCommitEventDetails];
}>();
defineSlots<{
  default?(scope: { state: SliderRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: SliderRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const field = inject(fieldKey, null);
const fieldset = inject(fieldsetKey, null);
const rootId = useId();
const { element, setElement } = useElement<HTMLDivElement>();
const inDisabledFieldset = useInDisabledFieldset(element);

const firstValue: number | readonly number[] =
  props.modelValue !== undefined ? props.modelValue : (props.defaultValue ?? props.min);
const { value, setOwn } = useModel<number | readonly number[]>(() => props.modelValue, firstValue);
const grid = computed(() => ({ min: props.min, max: props.max, step: props.step }));
const values = computed(() => shownValues(value.value, grid.value));
// Two values of the grid differ by a whole number of steps.
const distance = computed(() => props.step * Math.ceil(props.minStepsBetweenValues));
const formatter = computed(() => new Intl.NumberFormat(props.locale, props.format));

// The thumbs in the order of `setup`, and the labels.
const entries = shallowReactive<SliderThumbEntry[]>([]);
const labels = shallowReactive<{ readonly id: string }[]>([]);
const mounted = shallowRef(false);
const dragging = shallowRef(false);
const active = shallowRef<SliderThumbEntry>();
const lastActive = shallowRef<SliderThumbEntry>();
const elementRtl = shallowRef(false);
// The last accepted change of the press that is on.
let press: { change?: { value: Emitted; reason: 'track-press' | 'drag' } } | undefined;
// The last reset that the slider followed. Each thumb tells the root a reset.
let lastReset: Event | undefined;

/** The thumbs at the index of their values: the `index` prop, else the place of the thumb. */
const thumbs = computed(() => {
  const placed = entries.slice();
  // The server and the first render know only the order of `setup`.
  if (mounted.value) {
    placed.sort((a, b) => (a.element && b.element ? byDocumentOrder(a.element, b.element) : 0));
  }
  const byIndex: (SliderThumbEntry | undefined)[] = [];
  for (const [place, thumb] of placed.entries()) byIndex[thumb.index ?? place] ??= thumb;
  return byIndex;
});
const firstThumb = computed(() => thumbs.value.find(Boolean));
const isDisabled = computed(() => props.disabled || !!field?.disabled || inDisabledFieldset.value);
const labelId = computed(() => labels[0]?.id ?? field?.labelId);
const rtl = computed(() => attrs.dir === 'rtl' || (attrs.dir !== 'ltr' && elementRtl.value));
const state = computed<SliderRootState>(() => {
  const thumb = active.value;
  return {
    disabled: isDisabled.value,
    dragging: dragging.value,
    orientation: props.orientation,
    activeThumbIndex: thumb ? thumbs.value.indexOf(thumb) : -1,
    values: values.value,
    min: props.min,
    max: props.max,
    step: props.step,
    minStepsBetweenValues: props.minStepsBetweenValues,
    touched: field?.state.touched ?? false,
    dirty: field?.state.dirty ?? false,
    valid: field?.state.valid ?? null,
    filled: field?.state.filled ?? false,
  };
});

if (process.env.NODE_ENV !== 'production') {
  watch(
    () => props.max > props.min,
    (hasRange) => {
      if (!hasRange) {
        warn(
          'Slider `max` must be greater than `min`.',
          'With `max` at or below `min`, the slider has no range of values to choose from.',
          'Set `max` above `min`.',
        );
      }
    },
    { immediate: true },
  );
}

watch(values, (next) => field?.setValue(asValue(next), true), { immediate: true });

// The input of the first thumb is the control of the field.
watch(
  () => firstThumb.value?.input,
  (input, _, onCleanup) => {
    if (!input || !field) return;
    onCleanup(
      field.setControl({
        element: input,
        get id() {
          return firstThumb.value?.id ?? input.id;
        },
        get name() {
          return props.name;
        },
        get disabled() {
          return props.disabled || inDisabledFieldset.value;
        },
        readOnly: false,
        get inputs() {
          return thumbs.value.flatMap((thumb) => (thumb?.input ? [thumb.input] : []));
        },
      }),
    );
  },
  { flush: 'post' },
);

onMounted(() => {
  mounted.value = true;
  if (element.value) readDirection(element.value);
});

provide(sliderKey, {
  get state() {
    return state.value;
  },
  get thumbs() {
    return thumbs.value;
  },
  get lastActive() {
    return lastActive.value;
  },
  get edge() {
    return props.thumbAlignment === 'edge';
  },
  get largeStep() {
    return props.largeStep;
  },
  get name() {
    return field?.name ?? props.name;
  },
  get form() {
    return props.form;
  },
  get controlId() {
    return field?.controlId ?? rootId;
  },
  get labelId() {
    return labelId.value;
  },
  get hasFormat() {
    return props.format !== undefined;
  },
  get rtl() {
    return rtl.value;
  },
  text: (number) => formatter.value.format(number),
  readDirection,
  addThumb(thumb) {
    entries.push(thumb);
    return () => entries.splice(entries.indexOf(thumb), 1);
  },
  addLabel(label) {
    labels.push(label);
    return () => labels.splice(labels.indexOf(label), 1);
  },
  moveTo(index, target, reason, event) {
    if (!(props.max > props.min) || values.value[index] === undefined) return false;
    const next = moveThumb(values.value, index, target, grid.value, distance.value);
    const accepted = change(next, index, reason, event);
    if (accepted === undefined) return false;
    // After a key during a press, the end of the press commits only a later change.
    if (press) press.change = undefined;
    emit('valueCommitted', accepted, { reason, event } as SliderRootCommitEventDetails);
    return true;
  },
  dragTo(index, target, reason, event) {
    if (!(props.max > props.min) || values.value[index] === undefined) return index;
    const moved = dragThumb(values.value, index, target, {
      grid: grid.value,
      distance: distance.value,
      behavior: props.thumbCollisionBehavior,
      disabled: values.value.map((_, at) => !!thumbs.value[at]?.disabled),
    });
    const accepted = change(moved.values, moved.index, reason, event);
    if (accepted === undefined) return index;
    if (press) press.change = { value: accepted, reason };
    return moved.index;
  },
  startPress() {
    press = {};
    dragging.value = true;
  },
  endPress(event) {
    const committed = press?.change;
    press = undefined;
    dragging.value = false;
    if (event && committed) {
      emit('valueCommitted', committed.value, { reason: committed.reason, event });
    }
  },
  onFocus(thumb) {
    active.value = thumb;
    lastActive.value = thumb;
    if (thumb.input) readDirection(thumb.input);
  },
  onBlur(event) {
    const input = event.target as HTMLInputElement;
    if (active.value?.input === input) active.value = undefined;
    // A move of the focus to another thumb is not a leave, also for an input in another place.
    if (!thumbs.value.some((thumb) => thumb?.input && thumb.input === event.relatedTarget)) {
      field?.onLeave(input);
    }
  },
  // The form resets each input to the value that Vue wrote last, so the root writes no input.
  onReset(event) {
    if (event === lastReset) return;
    lastReset = event;
    field?.onReset(asValue(shownValues(firstValue, grid.value), typeof firstValue === 'number'));
    if (sameValues(value.value, firstValue)) return;
    setOwn(firstValue);
    emit('update:modelValue', firstValue as Emitted);
  },
});

defineExpose({ element });

function elementProps() {
  const named = 'aria-label' in attrs || 'aria-labelledby' in attrs;
  return mergeProps(
    {
      role: 'group',
      'aria-labelledby': named ? undefined : (labelId.value ?? fieldset?.legendId),
      ...stateAttributes(state.value),
    },
    attrs,
  );
}

function readDirection(target: Element) {
  elementRtl.value = getComputedStyle(target).direction === 'rtl';
  return elementRtl.value;
}

/** The value of an event: a number for a single slider, an array for a range. */
function asValue(next: readonly number[], single = typeof value.value === 'number') {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- A single slider has one value.
  return (single ? next[0]! : next) as Emitted;
}

/** Emits a change of the user. Returns the new value, or `undefined` when nothing changed. */
function change(
  next: readonly number[],
  index: number,
  reason: SliderRootChangeEventReason,
  event: Event,
): Emitted | undefined {
  const nextValue = asValue(next);
  let accepted: Emitted | undefined;
  if (!sameValues(nextValue, value.value)) {
    const details = Object.assign(createChangeEventDetails(reason, event), {
      activeThumbIndex: index,
    }) as SliderRootChangeEventDetails;
    emit('valueChange', nextValue, details);
    if (!details.isCanceled) {
      setOwn(nextValue);
      emit('update:modelValue', nextValue);
      accepted = nextValue;
    }
  }
  // The parent can refuse a controlled value, and an input can hold a value that the slider
  // refused. Vue writes only a value that changed, so each input shows its value again.
  nextTick(() => {
    showValues();
    if (accepted !== undefined) field?.onEdit();
  });
  return accepted;
}

function showValues() {
  for (const [index, thumb] of thumbs.value.entries()) {
    const shown = values.value[index];
    if (thumb?.input && shown !== undefined) thumb.input.value = String(shown);
  }
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
