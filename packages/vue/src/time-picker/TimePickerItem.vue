<script setup lang="ts">
import { computed } from 'vue';
import { toPlainTime } from '../common/date-time/temporal';
import { formatText } from '../common/date-time/text';
import { injectListbox, listKey } from './listbox';
import { useOption } from './option';
import { injectTimePicker } from './root';
import { hourCycleOption } from './times';
import type { TimePickerItemProps, TimePickerItemState } from './types';
import type { ElementSlotProps } from '../common/element';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<TimePickerItemProps>(), { disabled: false });
defineSlots<{
  default?(scope: { state: TimePickerItemState; text: string }): unknown;
  element?(scope: ElementSlotProps<TimePickerItemState> & { text: string }): unknown;
}>();

const picker = injectTimePicker('Item');
const list = injectListbox(listKey, 'Item', 'List');
const option = useOption(picker, list, {
  part: 'Item',
  key: () => props.time.toString(),
  selected: () =>
    picker.value !== null &&
    Temporal.PlainTime.compare(toPlainTime(picker.value), props.time) === 0,
  ownDisabled: () => props.disabled,
  disabled: () => props.disabled,
  time: () => props.time,
  as: () => props.as,
});
const { setElement, state, elementProps } = option;
const text = computed(() =>
  formatText(
    props.time,
    { hour: 'numeric', minute: '2-digit', hourCycle: hourCycleOption(picker.props.hourCycle) },
    picker.locale,
  ),
);

defineExpose({ element: option.element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
    :text="text"
  />
  <component :is="as" v-else-if="as && $slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text" />
  </component>
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">{{
    text
  }}</component>
  <button v-else-if="$slots.default" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :text="text" />
  </button>
  <button v-else v-bind="elementProps()" :ref="setElement">{{ text }}</button>
</template>
