<script lang="ts">
import type { FormHTMLAttributes } from 'vue';
import type { VaseUIGenericEventDetails } from '../internals/createVaseUIEventDetails';
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
   * After a change of a field clears its error, a write of the same value for that field does not show the error again, because Vue reports no change for an equal value.
   * Give a new object or a changed value. A delete and then a set also works.
   */
  errors?: Errors | undefined;
  /**
   * The listener of the `formSubmit` emit. The part reads it to know that a listener exists.
   * Bind a listener with `@form-submit`.
   */
  onFormSubmit?: FormSubmitListener<FormValues> | FormSubmitListener<FormValues>[] | undefined;
  /**
   * The listener of the `formSubmit` emit with the `.once` modifier. The part reads it to know that
   * a listener exists. Bind a listener with `@form-submit.once`.
   */
  onFormSubmitOnce?: FormSubmitListener<FormValues> | FormSubmitListener<FormValues>[] | undefined;
}
</script>

<script setup lang="ts" generic="FormValues extends Record<string, any> = any">
// vue-tsc resolves `FormValues` before it checks a `@form-submit` listener of a template.
// With the default `any`, that check accepts a listener that has a typed parameter.
import { computed, provide, shallowRef, toValue, watch } from 'vue';
import { EMPTY_OBJECT } from '../common/empty';
import { comesBeforeInSameTree } from '../internals/comesBeforeInSameTree';
import { createGenericEventDetails } from '../internals/createVaseUIEventDetails';
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

const formErrors = shallowRef<Errors>();
watch(
  () => props.errors,
  (errors) => {
    formErrors.value = errors && { ...errors };
  },
  { deep: 2, immediate: true },
);

function focusFirstInvalid() {
  // Disconnected controls keep their registration order. A field without a control can still block submit.
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

  validate();

  if (focusFirstInvalid()) {
    event.preventDefault();
    return;
  }

  submitted = true;
  emit('submit', event);

  if (props.onFormSubmit || props.onFormSubmitOnce) {
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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement<
  FormState,
  HTMLFormElement
>('form', props, {
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
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
