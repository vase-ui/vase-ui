<script setup lang="ts" generic="Value extends DateFieldRootValue = DateFieldRootValue">
import { shallowRef, useAttrs } from 'vue';
import { useDateTimeFieldRoot } from '../common/date-time-field/root';
import { useElement } from '../common/element';
import { assertTemporal } from '../common/date-time/temporal';
import type {
  DateFieldRootEmits,
  DateFieldRootProps,
  DateFieldRootState,
  DateFieldRootValue,
} from './types';

defineOptions({ inheritAttrs: false });

const props = defineProps<DateFieldRootProps<Value>>();
const emit = defineEmits<DateFieldRootEmits<Value>>();
defineSlots<{ default?(scope: { state: DateFieldRootState }): unknown }>();

assertTemporal('DateField.Root');

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
const inputElement = shallowRef<HTMLInputElement | null>(null);
const root = useDateTimeFieldRoot<Value>({
  family: 'date',
  props,
  element,
  inputElement,
  emitChange: (value, details) => emit('valueChange', value, details),
  emitModel: (value) => emit('update:modelValue', value),
});

function setInput(target: unknown) {
  inputElement.value = target as HTMLInputElement | null;
}

defineExpose({
  element,
  /** The input that gives the value to a form. */
  inputElement,
  /** Empties each segment. `update:modelValue` follows when the field had a value. */
  clear: root.clear,
});
</script>

<template>
  <component :is="as" v-if="as" v-bind="root.groupProps(attrs)" :ref="setElement">
    <slot :state="root.state.value" />
    <input v-bind="root.inputProps()" :ref="setInput" />
  </component>
  <div v-else v-bind="root.groupProps(attrs)" :ref="setElement">
    <slot :state="root.state.value" />
    <input v-bind="root.inputProps()" :ref="setInput" />
  </div>
</template>
