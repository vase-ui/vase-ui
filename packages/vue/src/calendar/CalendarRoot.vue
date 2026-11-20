<script
  setup
  lang="ts"
  generic="
    Value extends CalendarValue = Temporal.PlainDate,
    Multiple extends boolean | undefined = false
  "
>
import { computed, mergeProps, provide, shallowRef, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { useModel } from '../common/model';
import { assertTemporal, compareDates, withDate } from '../common/date-time/temporal';
import { calendarKey, useCalendar } from './root';
import type {
  CalendarRootChangeEventDetails,
  CalendarRootProps,
  CalendarRootState,
  CalendarRootView,
  CalendarValue,
} from './types';

type Output = Multiple extends true ? Value[] : Value;

defineOptions({ inheritAttrs: false });

assertTemporal('Calendar.Root');

const props = withDefaults(defineProps<CalendarRootProps<Value, Multiple>>(), {
  modelValue: undefined,
  defaultValue: undefined,
  month: undefined,
  focusedDate: undefined,
  view: undefined,
  showOutsideDays: undefined,
});
const emit = defineEmits<{
  /** The user changes the value. `details.cancel()` keeps the value as it is. */
  valueChange: [value: Output, details: CalendarRootChangeEventDetails];
  /** Comes after `valueChange`, unless a listener cancels the change. `v-model` uses it. */
  'update:modelValue': [value: Output];
  /** The user moves the page. `details.cancel()` keeps the page. */
  monthChange: [month: Temporal.PlainYearMonth, details: CalendarRootChangeEventDetails];
  /** Comes after `monthChange`, and for a move with no user event. `v-model:month` uses it. */
  'update:month': [month: Temporal.PlainYearMonth];
  /** A day or a cell gets the focus, or a key moves it. `details.cancel()` keeps the focused day. */
  focusedDateChange: [date: Temporal.PlainDate, details: CalendarRootChangeEventDetails];
  /** Comes after `focusedDateChange`, and for a move with no user event. `v-model:focusedDate` uses it. */
  'update:focusedDate': [date: Temporal.PlainDate];
  /** The user shows another view. `details.cancel()` keeps the view. */
  viewChange: [view: CalendarRootView, details: CalendarRootChangeEventDetails];
  /** Comes after `viewChange`, unless a listener cancels the change. `v-model:view` uses it. */
  'update:view': [view: CalendarRootView];
}>();
defineSlots<{
  default?(scope: { state: CalendarRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: CalendarRootState;
  }): unknown;
}>();

type Given = CalendarValue | readonly CalendarValue[] | null | undefined;
const toValues = (given: Given): readonly CalendarValue[] =>
  given == null ? [] : Array.isArray(given) ? given : [given as CalendarValue];

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const model = useModel<Given>(
  () => props.modelValue,
  props.defaultValue ?? (props.multiple ? [] : null),
);
const values = computed(() => toValues(model.value.value));
// A value that becomes empty keeps its kind for the next value.
const lastValue = shallowRef<CalendarValue | undefined>(values.value[0]);
watch(
  () => values.value[0],
  (first) => {
    if (first) lastValue.value = first;
  },
);
const template = computed(
  () => values.value[0] ?? toValues(props.defaultValue)[0] ?? lastValue.value,
);
const isSelected = (date: Temporal.PlainDate) =>
  values.value.some((value) => compareDates(value, date) === 0);
const createValue = (date: Temporal.PlainDate) =>
  template.value ? withDate(template.value, date) : date.withCalendar('iso8601');

function commit(next: CalendarValue | CalendarValue[], details: CalendarRootChangeEventDetails) {
  emit('valueChange', next as Output, details);
  if (details.isCanceled) return false;
  model.setOwn(next);
  emit('update:modelValue', next as Output);
  return true;
}

function add(date: Temporal.PlainDate, details: CalendarRootChangeEventDetails) {
  return (
    values.value.length < (props.maxDays ?? Infinity) &&
    commit([...values.value, createValue(date)], details)
  );
}

const {
  calendar: forParts,
  rootState,
  focus,
  rootProps,
} = useCalendar(props, {
  part: 'Calendar.Root',
  emit,
  element,
  views: true,
  selection: {
    get values() {
      return values.value;
    },
    get template() {
      return template.value;
    },
    get multiselectable() {
      return !!props.multiple;
    },
    range: null,
    isSelected,
    press(date, details) {
      if (!props.multiple) return isSelected(date) || commit(createValue(date), details);
      if (!isSelected(date)) return add(date, details);
      return (
        values.value.length > (props.minDays ?? 0) &&
        commit(
          values.value.filter((value) => compareDates(value, date) !== 0),
          details,
        )
      );
    },
    extend(date, details) {
      if (!isSelected(date)) add(date, details);
    },
  },
});
provide(calendarKey, forParts);

defineExpose({ element, focus });

function elementProps() {
  return mergeProps(rootProps(), attrs);
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="rootState"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="rootState" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="rootState" />
  </div>
</template>
