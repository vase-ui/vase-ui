<script setup lang="ts">
import { computed, provide, shallowRef, useAttrs } from 'vue';
import { EMPTY_OBJECT } from '../../src/common/empty';
import { FormContext } from '../../src/internals/form-context';
import type { Errors, FormField, FormValidationMode } from '../../src/internals/form-context';
import { createIdRegistry } from '../../src/internals/labelable-provider/createIdRegistry';
import { NOOP } from '../../src/internals/noop';

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  errors?: Errors | undefined;
}>();

const emit = defineEmits<{
  submit: [fields: { name: string | undefined; value: unknown; valid: boolean | null }[]];
}>();

const attrs = useAttrs();
const elementRef = shallowRef<HTMLFormElement | null>(null);
const { ids: fields, registerId: registerField } = createIdRegistry<FormField>();

provide(FormContext, {
  errors: computed(() => props.errors ?? EMPTY_OBJECT),
  clearErrors: NOOP,
  elementRef,
  fields,
  registerField,
  validationMode: computed<FormValidationMode>(() => 'onSubmit'),
  submitCountRef: shallowRef(0),
});

function submit(event: Event) {
  event.preventDefault();

  for (const field of fields.value) {
    field.validate();
  }

  // An entry has the validity of the moment of the read, so the form reads `fields` again.
  emit(
    'submit',
    fields.value.map(({ name, getValue, validityData }) => ({
      name,
      value: getValue(),
      valid: validityData.state.valid,
    })),
  );
}

function elementProps() {
  return { ...attrs, 'data-fields': fields.value.map(({ name }) => name).join(' ') };
}
</script>

<template>
  <form ref="elementRef" novalidate v-bind="elementProps()" @submit="submit"><slot /></form>
</template>
