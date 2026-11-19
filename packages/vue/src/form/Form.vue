<script setup lang="ts">
import { mergeProps, provide, ref, useAttrs, watch } from 'vue';
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
// The field of each control. A control that leaves the document leaves `form.elements`.
const fieldOfControl = new WeakMap<Element, FormField>();
const submitted = ref(false);
// A submit passed. The next change of `errors`, the answer of the server, moves the focus.
let focusAtAnswer = false;

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
  addControl(control, field) {
    fieldOfControl.set(control, field);
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
    firstInvalidControl(fieldsOfForm())?.focus();
  },
  { deep: true },
);

defineExpose({ element, validate });

function validate(name?: string) {
  const fields = [...fieldsOfForm().keys()].filter(
    (field) => name === undefined || field.name === name,
  );
  for (const field of fields) field.validate();
  return fields.every((field) => !field.invalid);
}

function elementProps() {
  return mergeProps({ novalidate: true, onSubmit, onReset }, attrs);
}

/**
 * The fields of the form with their controls, in the order of the document. The browser lists the
 * controls of the form: not a control that `KeepAlive` holds or that is outside the `<form>`, and
 * not a control that the `form` attribute gives to another form.
 */
function fieldsOfForm() {
  const fields = new Map<FormField, HTMLElement>();
  for (const control of element.value?.elements ?? []) {
    const field = fieldOfControl.get(control);
    if (field) fields.set(field, control as HTMLElement);
  }
  return fields;
}

function firstInvalidControl(fields: Map<FormField, HTMLElement>) {
  return [...fields].find(([field]) => field.invalid)?.[1];
}

function onSubmit(event: Event) {
  submitted.value = true;
  const fields = fieldsOfForm();
  for (const field of fields.keys()) field.validate();
  const invalid = firstInvalidControl(fields);
  if (invalid) {
    event.preventDefault();
    invalid.focus();
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
    removeErrors([...fieldsOfForm().keys()].map((field) => field.name));
  });
}

function removeErrors(names: (string | undefined)[]) {
  const errors = props.errors;
  if (!errors || !names.some((name) => name !== undefined && Object.hasOwn(errors, name))) return;
  const kept: FormErrors = {};
  for (const key of Object.keys(errors)) if (!names.includes(key)) kept[key] = errors[key]!;
  emit('update:errors', kept);
}
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="elementProps()" :elementRef="setElement" />
  <form v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </form>
</template>
