<script setup lang="ts" generic="Value extends TimeValue = Temporal.PlainTime">
import {
  computed,
  mergeProps,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  watchEffect,
} from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement, type ElementSlotProps } from '../common/element';
import { useModel } from '../common/model';
import { warn } from '../common/warn';
import { hourCycleOf } from '../common/date-time/format';
import { usePickerControl } from '../common/picker/control';
import {
  assertTemporal,
  toPlainTime,
  withTime,
  type TimeValue,
} from '../common/date-time/temporal';
import { useLocale } from '../locale-provider/part';
import { clockAttributes, clockKey } from './clock';
import type {
  TimeClockRootChangeEventDetails,
  TimeClockRootCommitEventDetails,
  TimeClockRootEmits,
  TimeClockRootProps,
  TimeClockRootState,
  TimeClockRootViewChangeEventDetails,
} from './types';
import {
  clampTime,
  dayPeriodOf,
  edgeValue,
  faceNumber,
  faceNumberOf,
  faceNumbers,
  gridOf,
  isTimeAllowed,
  isValidStep,
  nextView,
  stepOf,
  stepValue,
  timeOfDayPeriod,
  timeOfFaceNumber,
  type TimeClockDayPeriodValue,
  type TimeClockFaceNumber,
  type TimeClockView,
  type TimeLimits,
} from './views';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockRootProps<Value>>(), {
  granularity: 'minute',
  minuteStep: 1,
  secondStep: 1,
});
const emit = defineEmits<TimeClockRootEmits<Value>>();
defineSlots<{
  default?(scope: { state: TimeClockRootState }): unknown;
  element?(scope: ElementSlotProps<TimeClockRootState>): unknown;
}>();

assertTemporal('TimeClock.Root');

if (process.env.NODE_ENV !== 'production') {
  watchEffect(() => {
    for (const name of ['minuteStep', 'secondStep'] as const) {
      if (!isValidStep(props[name])) {
        warn(
          `TimeClock \`${name}\` must be a whole number above 0.`,
          'The clock uses a step of 1 instead.',
          `Set \`${name}\` to a whole number above 0.`,
        );
      }
    }
  });
}

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const shownLocale = useLocale(() => props.locale);
const { value, setOwn } = useModel<Value | null>(
  () => props.modelValue,
  props.modelValue === undefined ? (props.defaultValue ?? null) : props.modelValue,
);
const { value: shownView, setOwn: setOwnView } = useModel<TimeClockView>(
  () => props.view,
  props.defaultView ?? 'hour',
);
const dragging = shallowRef(false);
const numberElements = shallowReactive(new Map<Element, () => TimeClockFaceNumber>());

const rangeInput = shallowRef<HTMLInputElement | null>(null);
usePickerControl(() => rangeInput.value);

const shownHourCycle = computed(() => props.hourCycle ?? hourCycleOf(shownLocale.value));
const grid = computed(() =>
  gridOf(
    shownView.value,
    shownHourCycle.value,
    stepOf(shownView.value, props.minuteStep, props.secondStep),
  ),
);
const limits = computed<TimeLimits>(() => ({
  minTime: props.min,
  maxTime: props.max,
  disabledTimes: props.disabledTimes,
}));
const time = computed(() => {
  const like = value.value ?? props.referenceDate;
  return like === undefined ? new Temporal.PlainTime() : toPlainTime(like);
});
const selectedNumber = computed(() =>
  faceNumberOf(shownView.value, shownHourCycle.value, time.value),
);
const state = computed<TimeClockRootState>(() => ({
  view: shownView.value,
  disabled: props.disabled,
  readonly: props.readonly,
  dragging: dragging.value,
  empty: value.value === null,
}));

function isNumberDisabled(number: TimeClockFaceNumber) {
  const { first, step } = grid.value;
  const candidate = timeOfFaceNumber(shownView.value, shownHourCycle.value, time.value, number);
  return (
    (number.value - first) % step !== 0 || !isTimeAllowed(candidate, shownView.value, limits.value)
  );
}

// A day period is disabled when none of its hours is allowed.
function isDayPeriodDisabled(period: TimeClockDayPeriodValue) {
  const firstHour = period === 'am' ? 0 : 12;
  return Array.from({ length: 12 }, (_, hour) => time.value.with({ hour: firstHour + hour })).every(
    (candidate) => !isTimeAllowed(candidate, 'hour', limits.value),
  );
}

// A selection puts the time into the limits. A first value has the kind of the reference date.
function changeTime(next: Temporal.PlainTime, details: TimeClockRootChangeEventDetails) {
  const like = value.value ?? props.referenceDate;
  const clamped = clampTime(next, limits.value);
  const nextValue = (like === undefined ? clamped : withTime(like, clamped)) as Value;
  emit('valueChange', nextValue, details);
  if (details.isCanceled) return null;
  setOwn(nextValue);
  emit('update:modelValue', nextValue);
  return nextValue;
}

function selectNumber(number: TimeClockFaceNumber, details: TimeClockRootChangeEventDetails) {
  if (props.disabled || props.readonly || isNumberDisabled(number)) return null;
  const candidate = timeOfFaceNumber(shownView.value, shownHourCycle.value, time.value, number);
  // A value outside the limits stays when the user selects its own number again.
  if (value.value !== null && candidate.equals(time.value)) return value.value;
  return changeTime(candidate, details);
}

const isEnabled = (candidate: number) =>
  !isNumberDisabled(faceNumber(shownView.value, shownHourCycle.value, candidate));

function selectValue(next: number | null, details: TimeClockRootChangeEventDetails) {
  if (next !== null) selectNumber(faceNumber(shownView.value, shownHourCycle.value, next), details);
}

function setView(next: TimeClockView, details: TimeClockRootViewChangeEventDetails) {
  if (next === shownView.value) return;
  emit('viewChange', next, details);
  if (details.isCanceled) return;
  setOwnView(next);
  emit('update:view', next);
}

function commit(details: TimeClockRootCommitEventDetails) {
  if (props.disabled || props.readonly) return;
  // A key commits the time that the face shows, also with no value. A press that selected no
  // number commits nothing.
  const committed =
    value.value ??
    (details.reason === 'keyboard'
      ? selectNumber(selectedNumber.value, createChangeEventDetails('keyboard', details.event))
      : null);
  if (committed === null) return;
  emit('valueCommitted', committed, details);
  const next = nextView(shownView.value, props.granularity);
  if (next) setView(next, createChangeEventDetails(details.reason, details.event));
}

provide(clockKey, {
  get state() {
    return state.value;
  },
  get view() {
    return shownView.value;
  },
  get hourCycle() {
    return shownHourCycle.value;
  },
  get locale() {
    return shownLocale.value;
  },
  get time() {
    return time.value;
  },
  get grid() {
    return grid.value;
  },
  get numbers() {
    return faceNumbers(shownView.value, shownHourCycle.value);
  },
  get selectedNumber() {
    return selectedNumber.value;
  },
  get dayPeriod() {
    return dayPeriodOf(time.value);
  },
  get outerNumbers() {
    return [...numberElements].filter(([, number]) => !number().inner).map(([el]) => el);
  },
  isNumberDisabled,
  isDayPeriodDisabled,
  selectNumber: (number, details) => selectNumber(number, details) !== null,
  stepNumber: (places, details) =>
    selectValue(stepValue(grid.value, selectedNumber.value.value, places, isEnabled), details),
  selectEdge: (edge, details) => selectValue(edgeValue(grid.value, edge, isEnabled), details),
  selectDayPeriod(period, details) {
    if (props.disabled || props.readonly || isDayPeriodDisabled(period)) return;
    if (value.value === null || period !== dayPeriodOf(time.value)) {
      changeTime(timeOfDayPeriod(time.value, period), details);
    }
  },
  setView,
  commit,
  setDragging: (next) => (dragging.value = next),
  setRangeInput: (input) => (rangeInput.value = input),
  addNumber(el, number) {
    numberElements.set(el, number);
    return () => numberElements.delete(el);
  },
});

defineExpose({ element });

function elementProps() {
  return mergeProps(
    {
      role: 'group',
      ...clockAttributes(state.value),
      // A server with other `Intl` data has other texts, and one with another hour cycle has
      // another count of numbers and no day period. The category covers each part in the root.
      'data-allow-mismatch': 'children',
    },
    attrs,
  );
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
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
