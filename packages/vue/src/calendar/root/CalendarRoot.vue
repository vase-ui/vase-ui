<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  CalendarBaseProps,
  CalendarChangeEventDetails,
  CalendarChangeEventReason,
  CalendarValue,
  CalendarView,
  CalendarViewProps,
  NavigationDirection,
} from '../../internals/date-time/calendar/useCalendarRoot';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface CalendarState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select a day or a month.
   */
  readOnly: boolean;
  /**
   * Whether the value of the calendar is not valid.
   */
  invalid: boolean;
  /**
   * Whether no day or month is selected.
   */
  empty: boolean;
}

export interface CalendarRootState extends CalendarState {
  /**
   * What the grid shows: `day`, `month` or `year`.
   */
  view: CalendarView;
  /**
   * Whether the grid shows more than one month.
   */
  multipleMonths: boolean;
  /**
   * The side of the last change of the page: `previous` or `next`, and `none` until the page
   * changes.
   */
  navigationDirection: NavigationDirection;
  /**
   * Whether the grid shows the broadcast calendar.
   */
  broadcastCalendar: boolean;
}

type CalendarInputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value | null;

type CalendarOutputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface CalendarRootProps<
  Value extends CalendarValue = Temporal.PlainDate,
  Multiple extends boolean | undefined = false,
>
  extends
    CalendarBaseProps,
    CalendarViewProps,
    VaseUIComponentProps<CalendarRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The selected day, or the list of selected days with `multiple`. A value that is a
   * `Temporal.PlainYearMonth` is a selected month, and the grid of months selects it. A new value
   * has the kind, the time, the time zone and the calendar of the value that the calendar has. A
   * value that becomes `null` or empty keeps them for the next value.
   * This is the controlled counterpart of `defaultValue`.
   */
  modelValue?: CalendarInputValue<Value, Multiple> | undefined;
  /**
   * The selected day, or the list of selected days with `multiple`, when the calendar first
   * renders. With no value, it also gives the kind of a new value.
   * This is the uncontrolled counterpart of `modelValue`.
   */
  defaultValue?: CalendarInputValue<Value, Multiple> | undefined;
  /**
   * Whether the user can select more than one day, or more than one month. A press on a selected day
   * removes it.
   * @default false
   */
  multiple?: (Multiple & boolean) | undefined;
  /**
   * The least number of days, or months, that stay selected with `multiple`. A press on a selected
   * day or month removes it only when more than this number stay selected.
   * @default 0
   */
  minDays?: number | undefined;
  /**
   * The greatest number of days, or months, that can be selected with `multiple`. A press on
   * another day or month changes nothing when the list is full.
   */
  maxDays?: number | undefined;
}

export type CalendarRootChangeEventReason = CalendarChangeEventReason;
export type CalendarRootChangeEventDetails = CalendarChangeEventDetails;
export type CalendarRootView = CalendarView;
</script>

<script
  setup
  lang="ts"
  generic="
    Value extends CalendarValue = Temporal.PlainDate,
    Multiple extends boolean | undefined = false
  "
>
import { computed, provide, shallowRef, watchSyncEffect } from 'vue';
import { EMPTY_ARRAY } from '../../common/empty';
import { useControlled } from '../../common/useControlled';
import { useCalendarRoot } from '../../internals/date-time/calendar/useCalendarRoot';
import { assertTemporal, compareDates, withDate } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useCastBooleanWarning } from '../../internals/useCastBooleanWarning';
import { useRenderElement } from '../../internals/useRenderElement';
import { CalendarRootContext } from './CalendarRootContext';
import { calendarRootStateAttributesMapping } from './stateAttributesMapping';

defineOptions({ inheritAttrs: false });

assertTemporal('Calendar.Root');

const props = withDefaults(defineProps<CalendarRootProps<Value, Multiple>>(), {
  as: 'div',
  modelValue: undefined,
  defaultValue: undefined,
  disabled: false,
  readOnly: false,
  invalid: false,
  autoFocus: false,
  numberOfMonths: 1,
  showOutsideDays: undefined,
  view: undefined,
  defaultView: undefined,
  visibleYears: 12,
});

if (process.env.NODE_ENV !== 'production') {
  useCastBooleanWarning('Calendar.Root');
}

const emit = defineEmits<{
  /**
   * Callback fired when the value changes.
   */
  valueChange: [
    value: CalendarOutputValue<Value, Multiple>,
    eventDetails: CalendarRootChangeEventDetails,
  ];
  /**
   * Event handler called after `valueChange` with the new value, unless a listener cancels the
   * change. `v-model` uses it.
   */
  'update:modelValue': [value: CalendarOutputValue<Value, Multiple>];
  /**
   * Callback fired when the month that the grid shows changes.
   */
  monthChange: [month: Temporal.PlainYearMonth, eventDetails: CalendarRootChangeEventDetails];
  /**
   * Event handler called after `monthChange` with the new month, unless a listener cancels the
   * change. `v-model:month` uses it.
   */
  'update:month': [month: Temporal.PlainYearMonth];
  /**
   * Callback fired when the day that has the tab stop changes.
   */
  focusedDateChange: [date: Temporal.PlainDate, eventDetails: CalendarRootChangeEventDetails];
  /**
   * Event handler called after `focusedDateChange` with the new day, unless a listener cancels the
   * change. `v-model:focusedDate` uses it.
   */
  'update:focusedDate': [date: Temporal.PlainDate];
  /**
   * Callback fired when the grid shows another view.
   */
  viewChange: [view: CalendarView, eventDetails: CalendarRootChangeEventDetails];
  /**
   * Event handler called after `viewChange` with the new view, unless a listener cancels the
   * change. `v-model:view` uses it.
   */
  'update:view': [view: CalendarView];
}>();

defineSlots<{
  default(props: { state: CalendarRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarRootState>;
}>();

type DayValue = CalendarValue | readonly CalendarValue[] | null | undefined;

function isList(input: DayValue): input is readonly CalendarValue[] {
  return Array.isArray(input);
}

function toValues(input: DayValue): readonly CalendarValue[] {
  if (input == null) {
    return EMPTY_ARRAY;
  }
  return isList(input) ? input : [input];
}

const value = useControlled<DayValue>({
  controlled: () => props.modelValue,
  default: () => props.defaultValue ?? (props.multiple ? EMPTY_ARRAY : null),
  name: 'Calendar',
  state: 'value',
});

const values = computed(() => toValues(value.value));
const multiselectable = computed(() => props.multiple === true);

const lastValue = shallowRef<CalendarValue>();
watchSyncEffect(() => {
  const first = values.value[0];
  if (first) {
    lastValue.value = first;
  }
});
const template = computed(
  () => values.value[0] ?? toValues(props.defaultValue)[0] ?? lastValue.value,
);

function isSelected(date: Temporal.PlainDate) {
  return values.value.some((item) => compareDates(item, date) === 0);
}

// Without a template, a new value is a date in the ISO calendar.
function createValue(date: Temporal.PlainDate): CalendarValue {
  const like = template.value;
  return like ? withDate(like, date) : date.withCalendar('iso8601');
}

function commit(next: CalendarValue | CalendarValue[], details: CalendarChangeEventDetails) {
  const output = next as CalendarOutputValue<Value, Multiple>;
  emit('valueChange', output, details);
  if (details.isCanceled) {
    return;
  }
  emit('update:modelValue', output);
  value.value = next;
}

function add(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
  if (values.value.length < (props.maxDays ?? Infinity)) {
    commit([...values.value, createValue(date)], details);
  }
}

function press(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
  if (!props.multiple) {
    if (!isSelected(date)) {
      commit(createValue(date), details);
    }
  } else if (!isSelected(date)) {
    add(date, details);
  } else if (values.value.length > (props.minDays ?? 0)) {
    commit(
      values.value.filter((item) => compareDates(item, date) !== 0),
      details,
    );
  }
}

function extend(date: Temporal.PlainDate, details: CalendarChangeEventDetails) {
  if (!isSelected(date)) {
    add(date, details);
  }
}

const { focus, hydrationAttributes, ...controller } = useCalendarRoot({
  part: 'Calendar.Root',
  props,
  emit,
  selection: { values, template, multiselectable, isSelected, press, extend },
  views: true,
});

// The parts get the state that they share. The root adds the state of the pages.
const state = computed<CalendarState>(() => ({
  disabled: props.disabled,
  readOnly: props.readOnly,
  invalid: props.invalid,
  empty: values.value.length === 0,
}));
const rootState = computed<CalendarRootState>(() => ({
  ...state.value,
  view: controller.view.value,
  multipleMonths: controller.pages.value.length > 1,
  navigationDirection: controller.navigationDirection.value,
  broadcastCalendar: props.broadcastCalendar === true,
}));

provide(CalendarRootContext, { ...controller, state });

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state: rootState,
  stateAttributesMapping: calendarRootStateAttributesMapping,
  props: (attrs) => [
    {
      role: 'group',
      // The label that the consumer gives replaces the name of the month. An `aria-labelledby` of
      // `null` gives no label, so the root keeps the name of the month (VUE-103).
      'aria-label': attrs['aria-labelledby'] == null ? controller.label.value : undefined,
      ...hydrationAttributes(),
    },
    attrs,
  ],
});

defineExpose({ element, focus });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="rootState" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="rootState" />
  </component>
</template>
