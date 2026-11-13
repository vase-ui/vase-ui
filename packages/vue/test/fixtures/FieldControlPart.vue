<script setup lang="ts">
import { shallowRef, useAttrs } from 'vue';
import { useFieldRootContext } from '../../src/internals/field-root-context';
import { useSetFieldFocused } from '../../src/internals/field-root-context/useSetFieldFocused';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  value?: string | undefined;
  disabled?: boolean | undefined;
}>();

const emit = defineEmits<{
  focusedChange: [focused: boolean];
}>();

const attrs = useAttrs();
const { validation, setFilled } = useFieldRootContext();
const inputElement = shallowRef<HTMLInputElement | null>(null);

const setFocused = useSetFieldFocused(
  () => props.disabled,
  inputElement,
  (focused) => emit('focusedChange', focused),
);

if (props.value !== undefined) {
  setFilled(props.value !== '');
}

function setInputElement(element: unknown) {
  inputElement.value = element as HTMLInputElement | null;
  validation.inputRef.value = element as HTMLInputElement | null;
}

function elementProps() {
  return {
    ...attrs,
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
