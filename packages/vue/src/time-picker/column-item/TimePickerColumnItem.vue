<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { TimePickerColumnValue } from '../root/TimePickerRootContext';

export interface TimePickerColumnItemState {
  /**
   * Whether the time of the picker has the value of the item in the column.
   */
  selected: boolean;
  /**
   * Whether the user cannot select the item, or the picker ignores user interaction.
   */
  disabled: boolean;
}

export interface TimePickerColumnItemProps
  extends
    VaseUIComponentProps<TimePickerColumnItemState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The value that the item selects: a number for an hour, a minute or a second, and `'am'` or
   * `'pm'` for a day period. It is the `value` of the slot `item` of `TimePicker.Column`.
   * An hour of a 12-hour cycle goes from 1 to 12, and 12 is the first hour of the day.
   */
  value: TimePickerColumnValue;
  /**
   * Whether the user cannot select the item.
   * `minTime` and `maxTime` of the picker also disable an item.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { clampTime } from '../../time-clock/utils/clockViews';
import {
  useTimePickerColumnContext,
  useTimePickerRootContext,
  columnText,
  isColumnValueAllowed,
  timeOfColumnValue,
  useTimePickerFormat,
  useTimePickerOption,
} from '../root/TimePickerRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerColumnItemProps>(), {
  as: 'div',
  disabled: false,
});

defineSlots<{
  default(props: { state: TimePickerColumnItemState; text: string }): unknown;
  render(props: { props: HTMLProps; state: TimePickerColumnItemState; text: string }): unknown;
}>();

const picker = useTimePickerRootContext();
const column = useTimePickerColumnContext();
const { locale, hourCycle } = useTimePickerFormat(picker);

const limits = computed(() => ({
  minTime: picker.props.minTime,
  maxTime: picker.props.maxTime,
  disabledTimes: undefined,
}));

const selected = computed(() => column.selectedValue.value === props.value);
const isDisabled = computed(
  () =>
    props.disabled ||
    picker.disabled.value ||
    !isColumnValueAllowed(
      column.unit.value,
      hourCycle.value,
      picker.time.value,
      props.value,
      limits.value,
    ),
);

const state = computed<TimePickerColumnItemState>(() => ({
  selected: selected.value,
  disabled: isDisabled.value,
}));

const text = computed(() =>
  columnText(column.unit.value, hourCycle.value, props.value, locale.value),
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [...optionProps(), attrs],
});

const optionProps = useTimePickerOption(element, {
  picker,
  selected,
  disabled: isDisabled,
  closeOnSelect: column.closeOnSelect,
  // An hour or a minute that has times out of the limits moves the time into them.
  time: () =>
    clampTime(
      timeOfColumnValue(column.unit.value, hourCycle.value, picker.time.value, props.value),
      limits.value,
    ),
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :text="text" />
  <component
    :is="as"
    v-else-if="$slots.default || as !== 'div'"
    v-bind="elementProps()"
    :ref="setRef"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <div v-else v-bind="elementProps()" :ref="setRef">{{ text }}</div>
</template>
