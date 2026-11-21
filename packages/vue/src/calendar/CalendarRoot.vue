<script
  setup
  lang="ts"
  generic="
    Value extends CalendarValue = Temporal.PlainDate,
    Multiple extends boolean | undefined = false
  "
>
import { computed, mergeProps, provide, shallowRef, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { useModel } from '../common/model';
import { assertTemporal, compareDates, withDate } from '../common/date-time/temporal';
import { calendarKey, useCalendar } from './root';
import type {
  CalendarRootChangeEventDetails,
  CalendarRootEmits,
  CalendarRootProps,
  CalendarRootState,
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
const emit = defineEmits<CalendarRootEmits<Value, Multiple>>();
defineSlots<{
  default?(scope: { state: CalendarRootState }): unknown;
  element?(scope: ElementSlotProps<CalendarRootState>): unknown;
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

defineExpose({
  element,
  /** Focuses the day or the cell that has the tab stop. With `date`, shows its page and focuses it, when it can take the focus. */
  focus,
});

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
