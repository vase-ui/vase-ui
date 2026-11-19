<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  VaseUIChangeEventDetails,
  VaseUIGenericEventDetails,
} from '../../internals/createVaseUIEventDetails';
import type { TimeValue } from '../../internals/date-time/temporal';
import { REASONS } from '../../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimeClockView } from '../utils/clockViews';

export type { TimeClockView } from '../utils/clockViews';

export interface TimeClockRootState {
  /**
   * The unit that the face shows.
   */
  view: TimeClockView;
  /**
   * Whether the clock should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user can see the time but not change it.
   */
  readOnly: boolean;
  /**
   * Whether the user is dragging on the face.
   */
  dragging: boolean;
  /**
   * Whether the clock has no value.
   */
  empty: boolean;
}

export interface TimeClockRootProps<Value extends TimeValue = Temporal.PlainTime>
  extends
    VaseUIComponentProps<TimeClockRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The time of the clock.
   * `null` is a controlled clock that has no time.
   *
   * To render an uncontrolled clock, use the `defaultValue` prop instead.
   */
  modelValue?: Value | null | undefined;
  /**
   * The time of an uncontrolled clock when it first renders.
   *
   * To render a controlled clock, use the `modelValue` prop instead.
   */
  defaultValue?: Value | null | undefined;
  /**
   * The unit that the face shows.
   *
   * To render an uncontrolled view, use the `defaultView` prop instead.
   */
  view?: TimeClockView | undefined;
  /**
   * The unit that an uncontrolled clock shows when it first renders.
   *
   * To render a controlled view, use the `view` prop instead.
   * @default 'hour'
   */
  defaultView?: TimeClockView | undefined;
  /**
   * The smallest unit that the user selects.
   * When the user commits a unit, the face shows the next unit, up to this one.
   * @default 'minute'
   */
  granularity?: TimeClockView | undefined;
  /**
   * The hour cycle of the face.
   * A 12-hour face has the hours 1 to 12, and the day period selects the half of the day.
   * A 24-hour face has an inner ring for the hours 13 to 23 and 0.
   * The default is the hour cycle of the locale.
   */
  hourCycle?: 12 | 24 | undefined;
  /**
   * The step of the minutes. The user selects a minute for each step.
   * @default 1
   */
  minuteStep?: number | undefined;
  /**
   * The step of the seconds. The user selects a second for each step.
   * @default 1
   */
  secondStep?: number | undefined;
  /**
   * The earliest time that the user can select.
   */
  minTime?: Temporal.PlainTime | undefined;
  /**
   * The latest time that the user can select.
   */
  maxTime?: Temporal.PlainTime | undefined;
  /**
   * Returns `true` for a time that the user cannot select.
   * It gets the time that the user would select, which has the unit of the view set to the number,
   * and the view.
   */
  disabledTimes?: ((time: Temporal.PlainTime, view: TimeClockView) => boolean) | undefined;
  /**
   * The time that the face shows while the clock has no value, and the source of the first value.
   * The first value has the kind, the date and the time zone of `referenceDate`.
   * With no `referenceDate`, the face shows 00:00 and the first value is a `Temporal.PlainTime`.
   */
  referenceDate?: Value | undefined;
  /**
   * The locale of the texts and of the hour cycle.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * Whether the clock should ignore user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * Whether the user can see the time but not change it.
   * @default false
   */
  readOnly?: boolean | undefined;
}

export type TimeClockRootChangeEventReason =
  | typeof REASONS.drag
  | typeof REASONS.keyboard
  | typeof REASONS.inputChange
  | typeof REASONS.itemPress;
export type TimeClockRootChangeEventDetails =
  VaseUIChangeEventDetails<TimeClockRootChangeEventReason>;

export type TimeClockRootViewChangeEventReason =
  typeof REASONS.triggerPress | typeof REASONS.drag | typeof REASONS.keyboard;
export type TimeClockRootViewChangeEventDetails =
  VaseUIChangeEventDetails<TimeClockRootViewChangeEventReason>;

export type TimeClockRootCommitEventReason = typeof REASONS.drag | typeof REASONS.keyboard;
export type TimeClockRootCommitEventDetails =
  VaseUIGenericEventDetails<TimeClockRootCommitEventReason>;
</script>

<script setup lang="ts" generic="Value extends TimeValue = Temporal.PlainTime">
import {
  PickerClockOwner,
  usePickerControl,
} from '../../internals/date-time/picker/PickerControlContext';
import { computed, provide, shallowReactive, watchEffect } from 'vue';
import { useServerValue } from '../../common/hydration';
import { useControlled } from '../../common/useControlled';
import { warn } from '../../common/warn';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { hourCycleOf } from '../../internals/date-time/format';
import { assertTemporal, toPlainTime, withTime } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
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
  parseHourCycle,
  stepOf,
  stepValue,
  timeOfDayPeriod,
  timeOfFaceNumber,
} from '../utils/clockViews';
import type { TimeClockDayPeriodValue, TimeClockFaceNumber, TimeLimits } from '../utils/clockViews';
import { TimeClockRootContext } from './TimeClockRootContext';

assertTemporal('TimeClock.Root');

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimeClockRootProps<Value>>(), {
  as: 'div',
  modelValue: undefined,
  view: undefined,
  granularity: 'minute',
  minuteStep: 1,
  secondStep: 1,
  disabled: false,
  readOnly: false,
});

const emit = defineEmits<{
  /**
   * Callback fired when the time changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   *
   * - `'drag'` when the user presses or drags on the face
   * - `'keyboard'` when the user presses a key on the face
   * - `'input-change'` when the range input of the face emits an input event, for example from a screen reader
   * - `'item-press'` when the user presses a day period
   *
   * The value has the kind, the date and the time zone of the present value.
   * To stop the change, call `eventDetails.cancel()` before the listener returns.
   */
  valueChange: [value: Value, eventDetails: TimeClockRootChangeEventDetails];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: Value];
  /**
   * Callback fired when the user commits the time: when a press or a drag that selects a number
   * ends, and when the user presses Enter or Space on the face.
   * A commit also shows the next view.
   * **Warning**: This is a generic event, not a change event.
   *
   * The `eventDetails.reason` indicates what triggered the commit:
   *
   * - `'drag'` when a press or a drag ends
   * - `'keyboard'` when the user presses Enter or Space on the face
   */
  valueCommitted: [value: Value, eventDetails: TimeClockRootCommitEventDetails];
  /**
   * Callback fired when the view changes.
   *
   * The `eventDetails.reason` indicates what triggered the change:
   *
   * - `'trigger-press'` when the user presses a view trigger
   * - `'drag'` and `'keyboard'` when a commit shows the next view
   *
   * To stop the change, call `eventDetails.cancel()` before the listener returns.
   */
  viewChange: [view: TimeClockView, eventDetails: TimeClockRootViewChangeEventDetails];
  /**
   * Event handler called after `viewChange` with the new view, unless a listener cancels the
   * change. `v-model:view` uses it.
   */
  'update:view': [view: TimeClockView];
}>();

defineSlots<{
  default(props: { state: TimeClockRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, TimeClockRootState>;
}>();

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

const formatLocale = useFormatLocale(() => props.locale);

const currentValue = useControlled<Value | null>({
  controlled: () => props.modelValue,
  default: () => props.defaultValue ?? null,
  name: 'TimeClock',
});
const currentView = useControlled<TimeClockView>({
  controlled: () => props.view,
  default: () => props.defaultView ?? 'hour',
  name: 'TimeClock',
  state: 'view',
});

const draggingFaces = shallowReactive(new Set<HTMLElement>());
const inputs = new Set<HTMLInputElement>();
const lastInput = () => Array.from(inputs).at(-1);
usePickerControl(PickerClockOwner, lastInput);

// A server and a browser can have other `Intl` data for the locale, and the hour cycle changes the
// numbers of the face and the day periods.
const { value: shownHourCycle, attributes: hourCycleAttributes } = useServerValue(
  'data-vase-ui-hour-cycle',
  () => props.hourCycle ?? hourCycleOf(formatLocale.value),
  parseHourCycle,
);
const grid = computed(() =>
  gridOf(
    currentView.value,
    shownHourCycle.value,
    stepOf(currentView.value, props.minuteStep, props.secondStep),
  ),
);
const limits = computed<TimeLimits>(() => ({
  minTime: props.minTime,
  maxTime: props.maxTime,
  disabledTimes: props.disabledTimes,
}));

// With no value, the face shows the reference time.
const time = computed(() => {
  const like = currentValue.value ?? props.referenceDate;
  return like === undefined ? new Temporal.PlainTime() : toPlainTime(like);
});
const numbers = computed(() => faceNumbers(currentView.value, shownHourCycle.value));
const selectedNumber = computed(() =>
  faceNumberOf(currentView.value, shownHourCycle.value, time.value),
);
const dayPeriod = computed(() => dayPeriodOf(time.value));

function isNumberDisabled(number: TimeClockFaceNumber): boolean {
  const { first, step: gridStep } = grid.value;
  const candidate = timeOfFaceNumber(currentView.value, shownHourCycle.value, time.value, number);
  return (
    (number.value - first) % gridStep !== 0 ||
    !isTimeAllowed(candidate, currentView.value, limits.value)
  );
}

// A day period is disabled when none of its hours is allowed. The hour of the present time can be
// out of the limits, and the user must still be able to go to the other half of the day.
function isDayPeriodDisabled(period: TimeClockDayPeriodValue): boolean {
  const firstHour = period === 'am' ? 0 : 12;
  return Array.from({ length: 12 }, (_, hour) => time.value.with({ hour: firstHour + hour })).every(
    (candidate) => !isTimeAllowed(candidate, 'hour', limits.value),
  );
}

// The first value has the kind of the reference. With no reference, it is a plain time.
function valueOfTime(newTime: Temporal.PlainTime): Value {
  const like = currentValue.value ?? props.referenceDate;
  return like === undefined ? (newTime as Value) : withTime(like, newTime);
}

// Gives the value that the clock has after the change, or `null` when the change did not happen.
function changeTime(
  newTime: Temporal.PlainTime,
  details: TimeClockRootChangeEventDetails,
): Value | null {
  const next = valueOfTime(clampTime(newTime, limits.value));
  emit('valueChange', next, details);
  if (details.isCanceled) {
    return null;
  }
  emit('update:modelValue', next);
  currentValue.value = next;
  return next;
}

function selectNumber(
  number: TimeClockFaceNumber,
  details: TimeClockRootChangeEventDetails,
): Value | null {
  if (props.disabled || props.readOnly || isNumberDisabled(number)) {
    return null;
  }
  const candidate = timeOfFaceNumber(currentView.value, shownHourCycle.value, time.value, number);
  // A value that is out of the range stays when the user selects its own number again.
  if (currentValue.value !== null && candidate.equals(time.value)) {
    return currentValue.value;
  }
  return changeTime(candidate, details);
}

function stepNumber(places: number, details: TimeClockRootChangeEventDetails) {
  const next = stepValue(
    grid.value,
    selectedNumber.value.value,
    places,
    (candidate) =>
      !isNumberDisabled(faceNumber(currentView.value, shownHourCycle.value, candidate)),
  );
  if (next !== null) {
    selectNumber(faceNumber(currentView.value, shownHourCycle.value, next), details);
  }
}

function selectEdge(edge: 'first' | 'last', details: TimeClockRootChangeEventDetails) {
  const next = edgeValue(
    grid.value,
    edge,
    (candidate) =>
      !isNumberDisabled(faceNumber(currentView.value, shownHourCycle.value, candidate)),
  );
  if (next !== null) {
    selectNumber(faceNumber(currentView.value, shownHourCycle.value, next), details);
  }
}

function selectDayPeriod(
  period: TimeClockDayPeriodValue,
  details: TimeClockRootChangeEventDetails,
) {
  if (props.disabled || props.readOnly || isDayPeriodDisabled(period)) {
    return;
  }
  if (currentValue.value === null || period !== dayPeriod.value) {
    changeTime(timeOfDayPeriod(time.value, period), details);
  }
}

function setView(newView: TimeClockView, details: TimeClockRootViewChangeEventDetails) {
  if (newView === currentView.value) {
    return;
  }
  emit('viewChange', newView, details);
  if (details.isCanceled) {
    return;
  }
  emit('update:view', newView);
  currentView.value = newView;
}

function commit(details: TimeClockRootCommitEventDetails) {
  if (props.disabled || props.readOnly) {
    return;
  }
  // A key commits the time that the face shows, also when the clock has no value. A press that
  // selected no time has nothing to commit.
  const committed =
    currentValue.value ??
    (details.reason === REASONS.keyboard
      ? selectNumber(
          selectedNumber.value,
          createChangeEventDetails(REASONS.keyboard, details.event),
        )
      : null);
  if (committed === null) {
    return;
  }
  emit('valueCommitted', committed, details);
  const next = nextView(currentView.value, props.granularity);
  if (next !== undefined) {
    setView(next, createChangeEventDetails(details.reason, details.event));
  }
}

const state = computed<TimeClockRootState>(() => ({
  view: currentView.value,
  disabled: props.disabled,
  readOnly: props.readOnly,
  dragging: draggingFaces.size > 0,
  empty: currentValue.value === null,
}));

provide(TimeClockRootContext, {
  state,
  view: currentView,
  hourCycle: shownHourCycle,
  locale: computed(() => props.locale),
  grid,
  numbers,
  time,
  selectedNumber,
  dayPeriod,
  registerInput(input) {
    inputs.add(input);
    return () => inputs.delete(input);
  },
  focusInput() {
    lastInput()?.focus();
  },
  isNumberDisabled,
  isDayPeriodDisabled,
  setDragging(face, dragging) {
    if (dragging) draggingFaces.add(face);
    else draggingFaces.delete(face);
  },
  selectNumber: (number, details) => selectNumber(number, details) !== null,
  stepNumber,
  selectEdge,
  selectDayPeriod,
  setView,
  commit,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'group', ...hourCycleAttributes() }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
