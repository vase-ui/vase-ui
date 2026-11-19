<script setup lang="ts">
import {
  computed,
  inject,
  mergeProps,
  nextTick,
  onActivated,
  onDeactivated,
  provide,
  ref,
  shallowReactive,
  shallowRef,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { useElement } from '../common/element';
import { formKey } from '../form/field';
import { fieldKey, fieldStateAttributes, type FieldControl } from './control';
import { fieldPartsKey } from './root';
import type { FieldRootProps, FieldRootState, FieldValidateResult, FieldValidity } from './types';

type Failures = Omit<FieldValidity, 'valid'>;
interface Result {
  failures: Failures;
  errors: string[];
  /** The errors came from `validate`. */
  ofValidate: boolean;
}

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldRootProps>(), {
  validationDebounceTime: 0,
  // An absent `dirty` or `touched` lets the field own that state.
  dirty: undefined,
  touched: undefined,
});
const emit = defineEmits<{
  'update:dirty': [dirty: boolean];
  'update:touched': [touched: boolean];
}>();
defineSlots<{
  default?(scope: { state: FieldRootState; validity: FieldValidity; errors: string[] }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: FieldRootState;
  }): unknown;
}>();

const noFailures: Failures = {
  badInput: false,
  customError: false,
  patternMismatch: false,
  rangeOverflow: false,
  rangeUnderflow: false,
  stepMismatch: false,
  tooLong: false,
  tooShort: false,
  typeMismatch: false,
  valueMissing: false,
};
const passed: Result = { failures: noFailures, errors: [], ofValidate: false };

const attrs = useAttrs();
const form = inject(formKey, null);
const controlId = useId();
const { element, setElement } = useElement<HTMLDivElement>();

// The control is the last one that registered and is still there.
const controls = shallowReactive<FieldControl[]>([]);
const control = computed(() => controls.at(-1));
const describers = shallowReactive<{ readonly id: string; readonly shown: boolean }[]>([]);

const value = shallowRef<unknown>();
const firstValue = shallowRef<unknown>();
let hasValue = false;
const ownTouched = ref(false);
// `KeepAlive` holds the field.
const held = ref(false);
const result = shallowRef<Result | null>(null);
// The required rule: `valueMissing` counts after the field was dirty, a submit, or `validate()`.
let valueMissingCounts = false;
// The number of the last validation. The result of an earlier one changes nothing.
let validation = 0;
// The timer of a validation that waits.
let waiting: ReturnType<typeof setTimeout> | undefined;
// The message that the field set on the element with `setCustomValidity`.
let ownMessage = '';

const name = computed(() => props.name ?? control.value?.name);
const disabled = computed(() => props.disabled);
// The browser bars a disabled or read-only element from constraint validation.
const barred = computed(
  () => disabled.value || !!control.value?.disabled || !!control.value?.readOnly,
);
const mode = computed(() => props.validationMode ?? form?.validationMode ?? 'submit');
const validatesOnChange = computed(
  () => mode.value === 'change' || (mode.value === 'submit' && !!form?.submitted),
);
const formErrors = computed(() => {
  const errors = form?.errors;
  if (!name.value || !errors || !Object.hasOwn(errors, name.value)) return [];
  return [errors[name.value]].flat().filter((error): error is string => !!error);
});

const foundDirty = computed(() => value.value !== firstValue.value);
const valid = computed(() => {
  if (barred.value) return null;
  if (props.invalid || formErrors.value.length > 0) return false;
  return result.value && result.value.errors.length === 0;
});
const state = computed<FieldRootState>(() => ({
  disabled: disabled.value,
  touched: props.touched ?? ownTouched.value,
  dirty: props.dirty ?? foundDirty.value,
  valid: valid.value,
  filled: (value.value ?? '') !== '',
}));
const validity = computed<FieldValidity>(() => ({
  ...(barred.value ? noFailures : (result.value?.failures ?? noFailures)),
  valid: valid.value,
}));
const errors = computed(() => (barred.value ? [] : (result.value?.errors ?? [])));
const describedBy = computed(
  () =>
    describers
      .filter((describer) => describer.shown)
      .map((describer) => describer.id)
      .join(' ') || undefined,
);

watch(foundDirty, (dirty) => {
  if (dirty) valueMissingCounts = true;
  emit('update:dirty', dirty);
});

onActivated(() => (held.value = false));
onDeactivated(() => (held.value = true));

// A disabled field and a held field do not count for their form.
watch(
  () =>
    form && control.value && !disabled.value && !control.value.disabled && !held.value
      ? control.value
      : null,
  (current, _, onCleanup) => {
    if (!form || !current) return;
    const owner = (current.element as HTMLInputElement).form;
    // The browser gives a control with a `form` attribute to that other form.
    if (owner && owner !== form.element) return;
    onCleanup(
      form.addField({
        get name() {
          return name.value;
        },
        element: current.element,
        validate: validateAtOnce,
        get invalid() {
          return valid.value === false;
        },
      }),
    );
  },
  { immediate: true },
);

provide(fieldKey, {
  get disabled() {
    return disabled.value;
  },
  get name() {
    return name.value;
  },
  controlId,
  get describedBy() {
    return describedBy.value;
  },
  get state() {
    return state.value;
  },
  setControl(added) {
    controls.push(added);
    dropValidation();
    return () => {
      controls.splice(controls.indexOf(added), 1);
      dropValidation();
    };
  },
  setValue(next) {
    if (!hasValue) {
      hasValue = true;
      firstValue.value = next;
      value.value = next;
      return;
    }
    if (next === value.value) return;
    value.value = next;
    if (validatesOnChange.value) validateAfterChange();
  },
  onEdit,
  onLeave() {
    if (!state.value.touched) emit('update:touched', true);
    ownTouched.value = true;
    if (mode.value === 'blur') {
      // The field validates with the value that the blur listeners of the developer gave, after
      // the render of their change.
      clearTimeout(waiting);
      waiting = setTimeout(validateNow);
    }
  },
  onReset(next) {
    dropValidation();
    value.value = next;
    if (state.value.touched) emit('update:touched', false);
    ownTouched.value = false;
    result.value = null;
    valueMissingCounts = false;
    if (control.value) removeOwnMessage(control.value.element as HTMLInputElement);
  },
});

provide(fieldPartsKey, {
  get state() {
    return state.value;
  },
  get controlId() {
    return control.value?.id ?? controlId;
  },
  get validity() {
    return validity.value;
  },
  get errors() {
    return errors.value;
  },
  get formErrors() {
    return formErrors.value;
  },
  addDescriber(describer) {
    describers.push(describer);
    return () => describers.splice(describers.indexOf(describer), 1);
  },
});

defineExpose({ element, validate: validateAtOnce });

function elementProps() {
  return mergeProps(fieldStateAttributes(state.value, disabled.value), attrs);
}

function dropValidation() {
  validation++;
  clearTimeout(waiting);
}

function validateAfterChange() {
  dropValidation();
  if (props.validationDebounceTime > 0) {
    waiting = setTimeout(validateNow, props.validationDebounceTime);
  } else {
    // The element shows the new value after the next render.
    nextTick(validateNow);
  }
}

function validateAtOnce() {
  valueMissingCounts = true;
  validateNow();
}

function validateNow() {
  dropValidation();
  const current = validation;
  if (barred.value) return;
  const el = control.value?.element as HTMLInputElement | undefined;
  if (el) {
    removeOwnMessage(el);
    const failed = nativeFailure(el);
    if (failed) {
      result.value = failed;
      return;
    }
  }
  const output = props.validate?.(value.value);
  if (output instanceof Promise) {
    // Outside `submit` mode, an error of `validate` stays until the new result arrives.
    if (mode.value === 'submit' || !result.value?.ofValidate) result.value = null;
    output.then(
      (resolved) => {
        if (current === validation) applyResult(resolved);
      },
      () => {},
    );
  } else {
    applyResult(output);
  }
}

function nativeFailure(el: HTMLInputElement): Result | null {
  if (el.validity.valid) return null;
  const failures = failuresOf(el);
  if (onlyValueMissing(failures) && !valueMissingCounts) return null;
  return { failures, errors: [el.validationMessage], ofValidate: false };
}

function failuresOf(el: HTMLInputElement) {
  const failures = { ...noFailures };
  for (const key of Object.keys(noFailures) as (keyof Failures)[]) failures[key] = el.validity[key];
  return failures;
}

function onlyValueMissing(failures: Failures) {
  return failures.valueMissing && Object.values(failures).filter(Boolean).length === 1;
}

function applyResult(output: FieldValidateResult) {
  const messages = [output ?? []].flat().filter((message): message is string => !!message);
  if (messages.length === 0) {
    result.value = passed;
    return;
  }
  ownMessage = messages.join('\n').replaceAll('\r\n', '\n');
  (control.value?.element as HTMLInputElement | undefined)?.setCustomValidity(ownMessage);
  result.value = {
    failures: { ...noFailures, customError: true },
    errors: messages,
    ofValidate: true,
  };
}

function removeOwnMessage(el: HTMLInputElement) {
  // A message that other code set stays: it is a native failure.
  if (ownMessage && el.validationMessage === ownMessage) el.setCustomValidity('');
  ownMessage = '';
}

function onEdit() {
  if (name.value) form?.clearError(name.value);
  // An invalid field that does not validate at each change takes back only `valueMissing`.
  if (validatesOnChange.value || valid.value !== false) return;
  const el = control.value?.element as HTMLInputElement | undefined;
  if (!el) return;
  dropValidation();
  removeOwnMessage(el);
  const failures = failuresOf(el);
  if (!failures.valueMissing) {
    result.value = passed;
  } else if (onlyValueMissing(failures)) {
    result.value = { failures, errors: [el.validationMessage], ofValidate: false };
  }
}
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" :validity="validity" :errors="errors" />
  </div>
</template>
