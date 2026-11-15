<script setup lang="ts">
import { shallowRef, useAttrs } from 'vue';
import { useFieldInput, useRegisterFieldControl } from '../../src/internals/field-register-control';
import { useFieldRootContext } from '../../src/internals/field-root-context';
import { useSetFieldFocused } from '../../src/internals/field-root-context/useSetFieldFocused';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  id?: string | undefined;
  name?: string | undefined;
  value?: string | undefined;
  disabled?: boolean | undefined;
}>();

const emit = defineEmits<{
  focusedChange: [focused: boolean];
}>();

const attrs = useAttrs();
const { setFilled } = useFieldRootContext();
const giveFieldInput = useFieldInput();
const inputElement = shallowRef<HTMLInputElement | null>(null);

const setFocused = useSetFieldFocused(
  () => props.disabled,
  inputElement,
  (focused) => emit('focusedChange', focused),
);

useRegisterFieldControl(
  inputElement,
  () => props.id,
  () => props.value,
  undefined,
  () => !props.disabled,
  () => props.name,
);

if (props.value !== undefined) {
  setFilled(props.value !== '');
}

function setInputElement(element: unknown) {
  const input = element as HTMLInputElement | null;
  // Vue calls a function ref again on each patch, with the same element.
  if (input === inputElement.value) {
    return;
  }
  inputElement.value = input;
  giveFieldInput(input);
}

function elementProps() {
  return {
    ...attrs,
    id: props.id,
    value: props.value,
    'aria-disabled': props.disabled || undefined,
    onFocusin() {
      setFocused(true);
    },
    onFocusout() {
      setFocused(false);
    },
  };
}

defineExpose({ setFocused });
</script>

<template>
  <input :ref="setInputElement" v-bind="elementProps()" />
</template>
