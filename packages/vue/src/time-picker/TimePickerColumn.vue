<script setup lang="ts">
import { computed, mergeProps, onMounted, provide, useAttrs, watchEffect } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { toPlainTime } from '../common/date-time/temporal';
import { mergeGetters } from '../common/picker/root';
import { warn } from '../common/warn';
import { isValidStep } from '../time-clock/views';
import {
  columnValues,
  isColumnValueAllowed,
  selectedColumnValue,
  type TimePickerColumnValue,
} from './columns';
import { columnKey, useListbox } from './listbox';
import { injectTimePicker } from './root';
import TimePickerColumnItem from './TimePickerColumnItem.vue';
import type { TimePickerColumnProps, TimePickerColumnState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerColumnProps>(), { step: 1 });
defineSlots<{
  /** One value of the column. With no slot, the column renders a `TimePicker.ColumnItem` for each. */
  item?(scope: { value: TimePickerColumnValue; index: number }): unknown;
  element?(
    scope: ElementSlotProps<TimePickerColumnState> & { values: TimePickerColumnValue[] },
  ): unknown;
}>();

if (process.env.NODE_ENV !== 'production') {
  watchEffect(() => {
    if (!isValidStep(props.step)) {
      warn(
        'TimePicker.Column `step` must be a whole number above 0.',
        'The column uses a step of 1 instead.',
        'Set `step` to a whole number above 0.',
      );
    }
  });
}

const picker = injectTimePicker('Column');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const values = computed(() =>
  columnValues(props.unit, picker.hourCycle, isValidStep(props.step) ? props.step : 1),
);
const selected = computed(() =>
  picker.value === null
    ? undefined
    : selectedColumnValue(props.unit, picker.hourCycle, toPlainTime(picker.value)),
);
const outOfLimits = (value: TimePickerColumnValue) =>
  !isColumnValueAllowed(props.unit, picker.hourCycle, picker.time, value, {
    minTime: picker.props.min,
    maxTime: picker.props.max,
    disabledTimes: undefined,
  });
const listbox = useListbox({
  element,
  keys: () => values.value.map(String),
  selected: () => (selected.value === undefined ? undefined : String(selected.value)),
  disabled: (key) => {
    const value = values.value.find((each) => String(each) === key);
    return value !== undefined && outOfLimits(value);
  },
});
provide(
  columnKey,
  mergeGetters(listbox.forItem, {
    get unit() {
      return props.unit;
    },
    get closes() {
      return picker.props.closeOnSelect === true;
    },
    outOfLimits,
  }),
);

const label = computed(() =>
  new Intl.DisplayNames(picker.locale, { type: 'dateTimeField' }).of(props.unit),
);
// A 24-hour cycle has no day period.
const rendered = computed(() => props.unit !== 'dayPeriod' || picker.hourCycle === 12);
const state = computed<TimePickerColumnState>(() => ({
  unit: props.unit,
  disabled: picker.disabled,
  readonly: picker.readonly,
}));

function elementProps() {
  return mergeProps(
    {
      role: 'listbox',
      'aria-label': label.value,
      'aria-disabled': state.value.disabled ? 'true' : undefined,
      'aria-readonly': state.value.readonly ? 'true' : undefined,
      // A server with other `Intl` data has another name (test/measurements/picker.test.ts).
      'data-allow-mismatch': 'attribute',
      onKeydown: listbox.onKeydown,
      onFocusin: listbox.onFocusin,
    },
    attrs,
  );
}

// Vue keeps the attribute of the server while it hydrates, so the column writes its name again.
onMounted(() => {
  const name = elementProps()['aria-label'];
  if (typeof name === 'string') element.value?.setAttribute('aria-label', name);
});

defineExpose({ element });
</script>

<template>
  <template v-if="rendered">
    <slot
      v-if="$slots.element"
      name="element"
      :props="elementProps()"
      :elementRef="setElement"
      :state="state"
      :values="values"
    />
    <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
      <template v-for="(value, index) in values" :key="value">
        <slot v-if="$slots.item" name="item" :value="value" :index="index" />
        <TimePickerColumnItem v-else :value="value" />
      </template>
    </component>
    <div v-else v-bind="elementProps()" :ref="setElement">
      <template v-for="(value, index) in values" :key="value">
        <slot v-if="$slots.item" name="item" :value="value" :index="index" />
        <TimePickerColumnItem v-else :value="value" />
      </template>
    </div>
  </template>
</template>
