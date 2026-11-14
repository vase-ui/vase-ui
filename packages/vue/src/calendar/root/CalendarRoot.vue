<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type {
  CalendarBaseProps,
  CalendarChangeEventDetails,
  CalendarChangeEventReason,
} from '../../internals/date-time/calendar/calendarProps';
import type { DateValue } from '../../internals/date-time/temporal';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface CalendarRootState {
  /**
   * Whether the component should ignore user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user should be unable to select a day.
   */
  readOnly: boolean;
  /**
   * Whether the value of the calendar is not valid.
   */
  invalid: boolean;
  /**
   * Whether no day is selected.
   */
  empty: boolean;
}

type CalendarInputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? readonly Value[]
  : Value | null;

type CalendarOutputValue<Value, Multiple extends boolean | undefined> = Multiple extends true
  ? Value[]
  : Value;

export interface CalendarRootProps<
  Value extends DateValue = DateValue,
  Multiple extends boolean | undefined = false,
>
  extends
    CalendarBaseProps,
    VaseUIComponentProps<CalendarRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The selected day, or the list of selected days with `multiple`. A new value has the kind, the
   * time, the time zone and the calendar of the value that the calendar has.
   * This is the controlled counterpart of `defaultValue`.
   */
  value?: CalendarInputValue<Value, Multiple> | undefined;
  /**
   * The selected day, or the list of selected days with `multiple`, when the calendar first
   * renders. With no value, it also gives the kind of a new value.
   * This is the uncontrolled counterpart of `value`.
   */
  defaultValue?: CalendarInputValue<Value, Multiple> | undefined;
  /**
   * Whether the user can select more than one day. A press on a selected day removes it.
   * @default false
   */
  multiple?: (Multiple & boolean) | undefined;
  /**
   * The least number of days that stay selected with `multiple`. A press on a selected day
   * removes it only when more days than this stay selected.
   * @default 0
   */
  minDays?: number | undefined;
  /**
   * The greatest number of days that can be selected with `multiple`. A press on another day
   * changes nothing when the list is full.
   */
  maxDays?: number | undefined;
}

export type CalendarRootChangeEventReason = CalendarChangeEventReason;
export type CalendarRootChangeEventDetails = CalendarChangeEventDetails;
</script>

<script
  setup
  lang="ts"
  generic="Value extends DateValue = DateValue, Multiple extends boolean | undefined = false"
>
import { computed, provide } from 'vue';
import { useDaySelection } from '../../internals/date-time/calendar/daySelection';
import { useCalendarRoot } from '../../internals/date-time/calendar/useCalendarRoot';
import { assertTemporal } from '../../internals/date-time/temporal';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { CalendarRootContext } from './CalendarRootContext';

defineOptions({ inheritAttrs: false });

assertTemporal('Calendar.Root');

const props = withDefaults(defineProps<CalendarRootProps<Value, Multiple>>(), {
  as: 'div',
  value: undefined,
  defaultValue: undefined,
  disabled: false,
  readOnly: false,
  invalid: false,
  autoFocus: false,
});

const emit = defineEmits<{
  /**
   * Callback fired when the value changes.
   */
  valueChange: [
    value: CalendarOutputValue<Value, Multiple>,
    eventDetails: CalendarRootChangeEventDetails,
  ];
  'update:value': [value: CalendarOutputValue<Value, Multiple>];
  /**
   * Callback fired when the month that the grid shows changes.
   */
  monthChange: [month: Temporal.PlainYearMonth, eventDetails: CalendarRootChangeEventDetails];
  'update:month': [month: Temporal.PlainYearMonth];
  /**
   * Callback fired when the day that has the tab stop changes.
   */
  focusedDateChange: [date: Temporal.PlainDate, eventDetails: CalendarRootChangeEventDetails];
  'update:focusedDate': [date: Temporal.PlainDate];
}>();

defineSlots<{
  default(props: { state: CalendarRootState }): unknown;
  render: ComponentRenderFn<HTMLProps, CalendarRootState>;
}>();

const selection = useDaySelection(props, emit);
const { label, focus, ...controller } = useCalendarRoot({
  part: 'Calendar.Root',
  props,
  emit,
  selection,
});

const state = computed<CalendarRootState>(() => ({
  disabled: props.disabled,
  readOnly: props.readOnly,
  invalid: props.invalid,
  empty: selection.values.value.length === 0,
}));

provide(CalendarRootContext, { ...controller, state });

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      role: 'group',
      // The label that the consumer gives replaces the name of the month.
      'aria-label': attrs['aria-labelledby'] === undefined ? label.value : undefined,
    },
    attrs,
  ],
});

defineExpose({ element, focus });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
