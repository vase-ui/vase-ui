<script setup lang="ts" generic="Values extends Record<string, any> = any">
import { mergeProps, provide, ref, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { formKey, type FormErrors, type FormField, type FormValues } from './field';
import type { FormEmits, FormProps } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FormProps<Values>>(), { validationMode: 'submit' });
// A declared `submit` takes the native listener of the developer off the element, so the
// listener gets only the submits that pass.
const emit = defineEmits<FormEmits<Values>>();
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
  values,
});

watch(
  () => props.errors,
  () => {
    if (!focusAtAnswer) return;
    focusAtAnswer = false;
    firstInvalid(fieldsOfForm())?.element?.focus();
  },
  { deep: true },
);

defineExpose({
  element,
  /**
   * Validates each field of the form, or each field with the name `name`. Returns `true` when they
   * are valid. It does not wait for a promise of `validate`.
   */
  validate,
});

function validate(name?: string) {
  const fields = [...fieldsOfForm()].filter((field) => name === undefined || field.name === name);
  for (const field of fields) field.validate();
  return fields.every((field) => !field.invalid);
}

function elementProps() {
  return mergeProps({ novalidate: true, onSubmit: onNativeSubmit, onReset }, attrs);
}

/**
 * The fields of the form, in the order of the document. The browser lists the controls of the
 * form: not a control that `KeepAlive` holds or that is outside the `<form>`, and not a control
 * that the `form` attribute gives to another form.
 */
function fieldsOfForm() {
  const fields = new Set<FormField>();
  for (const control of element.value?.elements ?? []) {
    const field = fieldOfControl.get(control);
    if (field) fields.add(field);
  }
  return fields;
}

/** The value of each named field that is not disabled. With two fields of one name, the last wins. */
function values() {
  const result: FormValues = {};
  for (const field of fieldsOfForm()) {
    if (field.name !== undefined && !field.disabled) result[field.name] = field.value;
  }
  return result;
}

function firstInvalid(fields: Set<FormField>) {
  return [...fields].find((field) => field.invalid);
}

function onNativeSubmit(event: Event) {
  submitted.value = true;
  const fields = fieldsOfForm();
  for (const field of fields) field.validate();
  const invalid = firstInvalid(fields);
  if (invalid) {
    event.preventDefault();
    invalid.element?.focus();
    return;
  }
  focusAtAnswer = true;
  if (props.onSubmit || props.onSubmitOnce) event.preventDefault();
  emit('submit', event as SubmitEvent, values() as Values);
}

function onReset(event: Event) {
  // A listener after this one can still prevent the reset, so the form waits for the end of the
  // event.
  setTimeout(() => {
    if (event.defaultPrevented) return;
    submitted.value = false;
    focusAtAnswer = false;
    removeErrors([...fieldsOfForm()].map((field) => field.name));
  });
}

function removeErrors(names: (string | undefined)[]) {
  const errors = props.errors;
  if (!errors || !names.some((name) => name !== undefined && Object.hasOwn(errors, name))) return;
  const kept: FormErrors = {};
  for (const [key, error] of Object.entries(errors)) if (!names.includes(key)) kept[key] = error;
  emit('update:errors', kept);
}
</script>

<template>
  <slot v-if="$slots.element" name="element" :props="elementProps()" :elementRef="setElement" />
  <form v-else v-bind="elementProps()" :ref="setElement">
    <slot />
  </form>
</template>
