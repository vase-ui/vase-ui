<script lang="ts">
import type { FormHTMLAttributes } from 'vue';
import type { VaseUIGenericEventDetails } from '../internals/createBaseUIEventDetails';
import type { Errors, FormValidationMode } from '../internals/form-context';
import { REASONS } from '../internals/reasons';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../internals/types';

export type { FormValidationMode } from '../internals/form-context';

export type FormSubmitEventReason = typeof REASONS.none;

export type FormSubmitEventDetails = VaseUIGenericEventDetails<FormSubmitEventReason>;

export interface FormActions {
  validate: (fieldName?: string | undefined) => void;
}

export interface FormState {}

type FormSubmitListener<FormValues extends Record<string, any>> = (
  formValues: FormValues,
  eventDetails: FormSubmitEventDetails,
) => void;

export interface FormProps<FormValues extends Record<string, any> = Record<string, any>>
  extends
    VaseUIComponentProps<FormState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<FormHTMLAttributes>, 'onSubmit'> {
  /**
   * Determines when the form should be validated.
   * The `validationMode` prop on `<Field.Root>` takes precedence over this.
   *
   * - `onSubmit` (default): validates the field when the form is submitted, afterwards fields will re-validate on change.
   * - `onBlur`: validates a field when it loses focus.
   * - `onChange`: validates the field on every change to its value.
   *
   * @default 'onSubmit'
   */
  validationMode?: FormValidationMode | undefined;
  /**
   * Validation errors returned externally, typically after submission by a server or a form action.
   * This should be an object where keys correspond to the `name` attribute on `<Field.Root>`,
   * and values correspond to error(s) related to that field.
   * The form also follows a change that the consumer makes in place to a reactive object.
   */
  errors?: Errors | undefined;
  /**
   * The listener of the `formSubmit` emit. The part reads it to know that a listener exists.
   * Bind a listener with `@form-submit`.
   */
  onFormSubmit?: FormSubmitListener<FormValues> | FormSubmitListener<FormValues>[] | undefined;
}
</script>

<script setup lang="ts" generic="FormValues extends Record<string, any> = Record<string, any>">
import { computed, provide, shallowRef, toValue, watch } from 'vue';
import { EMPTY_OBJECT } from '../common/empty';
import { createGenericEventDetails } from '../internals/createBaseUIEventDetails';
import { FormContext } from '../internals/form-context';
import type { FormField } from '../internals/form-context';
import { createIdRegistry } from '../internals/labelable-provider/createIdRegistry';
import type { ComponentRenderFn, HTMLProps } from '../internals/types';
import { useRenderElement } from '../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FormProps<FormValues>>(), {
  as: 'form',
  validationMode: 'onSubmit',
});

const emit = defineEmits<{
  /**
   * Event handler called when the form is submitted and each field is valid.
   */
  submit: [event: SubmitEvent];
  /**
   * Event handler called when the form is submitted.
   * `preventDefault()` is called on the native submit event when used.
   * The form does not see a listener with `.once`. With no other listener, it does not call
   * that listener and does not prevent the native submit.
   */
  formSubmit: [formValues: FormValues, eventDetails: FormSubmitEventDetails];
}>();

defineSlots<{
  default(props: { state: FormState }): unknown;
  render: ComponentRenderFn<FormHTMLAttributes & Pick<HTMLProps, 'ref'>, FormState>;
}>();

const state: FormState = EMPTY_OBJECT;

const { ids: fields, registerId: registerField } = createIdRegistry<FormField>();
const submitCountRef = shallowRef(0);
let submitted = false;

function copyErrors(errors: Errors | undefined): Errors | undefined {
  return errors && { ...errors };
}

// A consumer can change a reactive `errors` object in place. The deep `watch` sees that change.
// The copy gives the context a new object to follow, because Vue tracks no `Object.hasOwn` of a
// reactive proxy.
const formErrors = shallowRef(copyErrors(props.errors));

watch(
  () => props.errors,
  (next) => {
    formErrors.value = copyErrors(next);
  },
  { deep: true },
);

function comesBeforeInSameTree(element: Node, reference: Node) {
  const position = element.compareDocumentPosition(reference);
  return (
    (position & Node.DOCUMENT_POSITION_DISCONNECTED) === 0 &&
    (position & Node.DOCUMENT_POSITION_FOLLOWING) !== 0
  );
}

function focusFirstInvalid() {
  // A field can be invalid without a focusable control (for example a checkbox group whose
  // custom validation failed while every checkbox is unmounted, disabled, or reassociated).
  // Keep submission blocked, but move focus to the first invalid field that has a usable control.
  // Registration order can diverge from DOM order (keyed fields reordered without
  // remounting, portals), so pick the first control by document position. For controls
  // in disconnected trees (e.g. separate shadow roots), where document position is
  // implementation-specific, keep registration order.
  let hasInvalid = false;
  let firstControl: HTMLElement | null = null;
  for (const field of fields.value) {
    if (field.validityData.state.valid !== false) {
      continue;
    }
    hasInvalid = true;
    const control = toValue(field.controlRef);
    if (control && (!firstControl || comesBeforeInSameTree(control, firstControl))) {
      firstControl = control;
    }
  }
  if (firstControl) {
    firstControl.focus();
    if (firstControl.tagName === 'INPUT') {
      (firstControl as HTMLInputElement).select();
    }
    return true;
  }
  return hasInvalid;
}

// The callback moves focus, so it runs after the DOM update.
watch(
  formErrors,
  () => {
    if (!submitted) {
      return;
    }

    submitted = false;
    focusFirstInvalid();
  },
  { flush: 'post' },
);

/**
 * Validates all fields when called. Optionally pass a field name to validate a single field.
 * @example
 * ```ts
 * // validate all fields
 * form.value?.validate();
 *
 * // validate one field
 * form.value?.validate('email');
 * ```
 */
function validate(fieldName?: string) {
  if (fieldName) {
    fields.value.find((field) => field.name === fieldName)?.validate();
  } else {
    for (const field of fields.value) {
      field.validate();
    }
  }
}

function handleSubmit(event: SubmitEvent) {
  submitCountRef.value += 1;

  // Async validation isn't supported to stop the submit event.
  for (const field of fields.value) {
    field.validate();
  }

  if (focusFirstInvalid()) {
    event.preventDefault();
    return;
  }

  submitted = true;
  emit('submit', event);

  if (props.onFormSubmit !== undefined) {
    event.preventDefault();

    const formValues = {} as FormValues;
    for (const field of fields.value) {
      if (field.name) {
        (formValues as Record<string, any>)[field.name] = field.getValue();
      }
    }

    emit('formSubmit', formValues, createGenericEventDetails(REASONS.none, event));
  }
}

const { element, elementProps } = useRenderElement<FormState, HTMLFormElement>('form', props, {
  state,
  props: (attrs) => [{ novalidate: true, onSubmit: handleSubmit }, attrs],
});

function clearErrors(name: string | undefined) {
  if (!name) {
    return;
  }
  const previousErrors = formErrors.value;
  if (!previousErrors || !Object.hasOwn(previousErrors, name)) {
    return;
  }
  const nextErrors = { ...previousErrors };
  delete nextErrors[name];
  formErrors.value = nextErrors;
}

provide(FormContext, {
  errors: computed(() => formErrors.value ?? EMPTY_OBJECT),
  clearErrors,
  elementRef: element,
  fields,
  registerField,
  validationMode: computed(() => props.validationMode),
  submitCountRef,
});

defineExpose({ element, validate });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
