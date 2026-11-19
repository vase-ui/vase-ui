<script setup lang="ts">
import { defineComponent, useTemplateRef } from 'vue';
import FieldRoot from '../../src/field/root/FieldRoot.vue';
import { useFieldRootContext } from '../../src/internals/field-root-context';
import type { FieldRootContext } from '../../src/internals/field-root-context/FieldRootContext';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  invalid?: boolean | undefined;
  disabled?: boolean | undefined;
  name?: string | undefined;
}>();

const emit = defineEmits<{
  validationChange: [value: unknown, cancelPending: boolean];
  validationCommit: [value: unknown];
}>();

const root = useTemplateRef('root');
let field: FieldRootContext;
const ObserveField = defineComponent(() => {
  field = useFieldRootContext(false);
  const { change } = field.validation;
  field.validation.change = (value, cancelPending = false) => {
    emit('validationChange', value, cancelPending);
    change(value, cancelPending);
  };
  return () => null;
});

function validateValue(value: unknown) {
  emit('validationCommit', value);
  return value === '' ? 'Required' : null;
}

defineExpose({
  validate: () => root.value!.validate(),
  get validityData() {
    return field.validityData.value;
  },
  get name() {
    return field.name.value;
  },
});
</script>

<template>
  <FieldRoot ref="root" v-bind="{ ...$attrs, ...props }" :validate="validateValue">
    <ObserveField />
    <slot />
  </FieldRoot>
</template>
