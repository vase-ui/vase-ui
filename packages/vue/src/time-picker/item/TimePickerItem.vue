<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface TimePickerItemState {
  /**
   * Whether the time of the picker is the time of the item.
   */
  selected: boolean;
  /**
   * Whether the user cannot select the item, or the picker ignores user interaction.
   */
  disabled: boolean;
}

export interface TimePickerItemProps
  extends
    VaseUIComponentProps<TimePickerItemState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * The time that the item selects.
   * It is the `time` of the slot `item` of `TimePicker.List`.
   * The text of the item is this time in the locale of the picker.
   */
  time: Temporal.PlainTime;
  /**
   * Whether the user cannot select the item.
   * @default false
   */
  disabled?: boolean | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { formatText } from '../../internals/date-time/calendar/formatText';
import { toPlainTime } from '../../internals/date-time/temporal';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useTimePickerRootContext } from '../root/TimePickerRootContext';
import { hourCycleOption } from '../utils/useTimePickerFormat';
import { useTimePickerOption } from '../utils/useTimePickerOption';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerItemProps>(), { as: 'div', disabled: false });

defineSlots<{
  default(props: { state: TimePickerItemState; text: string }): unknown;
  render(props: { props: HTMLProps; state: TimePickerItemState; text: string }): unknown;
}>();

const picker = useTimePickerRootContext();
const locale = useFormatLocale(() => picker.props.locale);

const selected = computed(
  () =>
    picker.value.value !== null &&
    Temporal.PlainTime.compare(toPlainTime(picker.value.value), props.time) === 0,
);
const isDisabled = computed(() => props.disabled || picker.disabled.value);

const state = computed<TimePickerItemState>(() => ({
  selected: selected.value,
  disabled: isDisabled.value,
}));

const text = computed(() =>
  formatText(
    props.time,
    { hour: 'numeric', minute: '2-digit', hourCycle: hourCycleOption(picker.props.hourCycle) },
    locale.value,
  ),
);

const { compositeRef, optionProps } = useTimePickerOption({
  picker,
  selected,
  disabled: isDisabled,
  closeOnSelect: picker.closeOnSelect,
  time: () => props.time,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [compositeRef],
  props: (attrs) => [...optionProps(), attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :text="text" />
  <component :is="as" v-else-if="$slots.default || as !== 'div'" v-bind="elementProps()"
    ><slot :state="state" :text="text">{{ text }}</slot></component
  >
  <div v-else v-bind="elementProps()">{{ text }}</div>
</template>
