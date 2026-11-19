<script setup lang="ts">
import { mergeProps, nextTick, provide, ref, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { formKey, type FormErrors, type FormField } from './field';
import type { FormProps } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FormProps>(), { validationMode: 'submit' });
// A declared `submit` takes the native listener of the developer off the element, so the
// listener gets only the submits that pass.
const emit = defineEmits<{
  submit: [event: SubmitEvent];
  'update:errors': [errors: FormErrors];
}>();
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const attrs = useAttrs();
const { element, setElement } = useElement<HTMLFormElement>();
const fields = new Set<FormField>();
const submitted = ref(false);
// A submit passed. The next change of `errors`, the answer of the server, moves the focus.
let focusAtAnswer = false;
// The errors that the form asked for in this tick. The prop has them after the next render.
let askedErrors: FormErrors | undefined;

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
  addField(field) {
    fields.add(field);
    return () => fields.delete(field);
  },
  onEdit(name) {
    focusAtAnswer = false;
    removeErrors([name]);
  },
});

watch(
  () => props.errors,
  () => {
    if (!focusAtAnswer) return;
    focusAtAnswer = false;
    focusFirst(fieldsOfForm().filter((field) => field.invalid));
  },
  { deep: true },
);

defineExpose({ element, validate });

function validate(name?: string) {
  const validated = fieldsOfForm().filter((field) => name === undefined || field.name === name);
  return validateEach(validated).length === 0;
}

function elementProps() {
  return mergeProps({ novalidate: true, onSubmit, onReset }, attrs);
}

// The browser tells which form owns the control of a field. A control that `KeepAlive` holds,
// a control outside the `<form>`, and a control that the `form` attribute gives to another form
// have another form or none.
function fieldsOfForm() {
  return [...fields].filter((field) => {
    const owner = (field.element as HTMLInputElement | undefined)?.form;
    return !!owner && owner === element.value;
  });
}

/** Validates the fields, and returns the invalid ones. */
function validateEach(validated: FormField[]) {
  for (const field of validated) field.validate();
  return validated.filter((field) => field.invalid);
}

function focusFirst(invalid: FormField[]) {
  let first: HTMLElement | undefined;
  for (const { element: control } of invalid) {
    if (!control) continue;
    if (!first || control.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING) {
      first = control;
    }
  }
  first?.focus();
}

function onSubmit(event: Event) {
  submitted.value = true;
  const invalid = validateEach(fieldsOfForm());
  if (invalid.length > 0) {
    event.preventDefault();
    focusFirst(invalid);
    return;
  }
  focusAtAnswer = true;
  emit('submit', event as SubmitEvent);
}

function onReset(event: Event) {
  // A listener after this one can still prevent the reset, so the form waits for the end of the
  // event.
  setTimeout(() => {
    if (event.defaultPrevented) return;
    submitted.value = false;
    focusAtAnswer = false;
    removeErrors(fieldsOfForm().map((field) => field.name));
  });
}

function removeErrors(names: (string | undefined)[]) {
  const errors = askedErrors ?? props.errors;
  if (!errors || !names.some((name) => name !== undefined && Object.hasOwn(errors, name))) return;
  const kept: FormErrors = {};
  for (const key of Object.keys(errors)) if (!names.includes(key)) kept[key] = errors[key]!;
  if (!askedErrors) nextTick(() => (askedErrors = undefined));
  askedErrors = kept;
  emit('update:errors', kept);
}
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="elementProps()" :elementRef="setElement" />
  <form v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </form>
</template>
