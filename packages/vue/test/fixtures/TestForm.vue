<script setup lang="ts">
import { provide, ref, shallowReactive, useTemplateRef, type PropType } from 'vue';
import { formKey, type FormField, type ValidationMode } from '../../src/form/field';

// A form for the tests: it validates its fields at a submit, and blocks it while one is invalid.
const props = defineProps({
  errors: Object as PropType<Record<string, string | string[]>>,
  validationMode: { type: String as PropType<ValidationMode>, default: 'submit' },
});
const emit = defineEmits<{
  submit: [];
  'update:errors': [errors: Record<string, string | string[]>];
}>();

const form = useTemplateRef('form');
const fields = shallowReactive<FormField[]>([]);
const submitted = ref(false);

provide(formKey, {
  get validationMode() {
    return props.validationMode;
  },
  get submitted() {
    return submitted.value;
  },
  get errors() {
    return props.errors;
  },
  get element() {
    return form.value;
  },
  addField(field) {
    fields.push(field);
    return () => fields.splice(fields.indexOf(field), 1);
  },
  clearError(name) {
    if (!props.errors || !Object.hasOwn(props.errors, name)) return;
    const { [name]: _, ...others } = props.errors;
    emit('update:errors', others);
  },
});

function submit(event: Event) {
  event.preventDefault();
  submitted.value = true;
  for (const field of fields) field.validate();
  const invalid = fields.filter((field) => field.invalid);
  if (invalid.length === 0) emit('submit');
  else invalid[0]!.element.focus();
}

defineExpose({ fields });
</script>

<template>
  <form ref="form" novalidate @submit="submit" @reset="submitted = false">
    <slot />
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
</template>
