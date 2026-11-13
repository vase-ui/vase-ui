<script setup lang="ts">
import { computed, provide, shallowRef } from 'vue';
import { FormContext } from '../../internals/form-context';
import type { Errors, FormField, FormValidationMode } from '../../internals/form-context';
import { createIdRegistry } from '../../internals/labelable-provider/createIdRegistry';
import { Field } from '../index';

const props = defineProps<{
  errors?: Errors | undefined;
  validationMode?: FormValidationMode | undefined;
  validate?: ((value: unknown) => string | null) | undefined;
}>();

const errorState = shallowRef<Errors>(props.errors ?? {});
const { ids: fields, registerId: registerField } = createIdRegistry<FormField>();

provide(FormContext, {
  errors: computed(() => errorState.value),
  clearErrors(name) {
    if (name === undefined || !Object.hasOwn(errorState.value, name)) {
      return;
    }
    const nextErrors = { ...errorState.value };
    delete nextErrors[name];
    errorState.value = nextErrors;
  },
  elementRef: shallowRef(null),
  fields,
  registerField,
  validationMode: computed(() => props.validationMode ?? 'onSubmit'),
  submitCountRef: shallowRef(0),
});
</script>

<template>
  <Field.Root name="name" :validate="validate" data-testid="root">
    <Field.Control data-testid="control" />
  </Field.Root>
</template>
