<script setup lang="ts">
import { computed, provide, shallowRef, useAttrs } from 'vue';
import { DEFAULT_VALIDITY_STATE, fieldValidityMapping } from '../../src/internals/field-constants';
import { useFieldControlRegistration } from '../../src/internals/field-register-control';
import {
  DEFAULT_FIELD_ROOT_CONTEXT,
  FieldRootContext,
} from '../../src/internals/field-root-context/FieldRootContext';
import type {
  FieldRootState,
  FieldValidityData,
} from '../../src/internals/field-root-context/FieldRootContext';
import { useFormContext } from '../../src/internals/form-context';
import { getStateAttributesProps } from '../../src/internals/getStateAttributesProps';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    invalid?: boolean | undefined;
    disabled?: boolean | undefined;
    name?: string | undefined;
  }>(),
  { invalid: false, disabled: false },
);

const emit = defineEmits<{
  validationChange: [value: unknown, cancelPending: boolean];
  validationCommit: [value: unknown];
}>();

const attrs = useAttrs();
const { errors } = useFormContext();

const touched = shallowRef(false);
const dirty = shallowRef(false);
const filled = shallowRef(false);
const focused = shallowRef(false);
const focusOwnerRef = shallowRef<unknown>();
const markedDirtyRef = shallowRef(false);
const validityData = shallowRef<FieldValidityData>({
  state: DEFAULT_VALIDITY_STATE,
  error: '',
  errors: [],
  value: null,
  initialValue: null,
});

function setValidityData(next: FieldValidityData) {
  validityData.value = next;
}

function change(value: unknown, cancelPending = false) {
  emit('validationChange', value, cancelPending);
}

// An empty value is invalid only after the field is marked dirty.
async function commit(value: unknown) {
  emit('validationCommit', value);
  setValidityData({
    ...validityData.value,
    value,
    state: { ...DEFAULT_VALIDITY_STATE, valid: !(value === '' && markedDirtyRef.value) },
  });
}

// The getters break the cycle between `invalid` and `registeredFieldName`.
const { validate, registerFieldControl, registeredFieldName } = useFieldControlRegistration({
  change,
  commit,
  invalid: () => invalid.value,
  markedDirtyRef,
  name: () => props.name,
  setValidityData,
  validityData,
});

const effectiveName = computed(() => props.name ?? registeredFieldName.value);

const invalid = computed(() => {
  const name = effectiveName.value;
  const formError = name && Object.hasOwn(errors.value, name) ? errors.value[name] : null;
  const hasFormError = !!(Array.isArray(formError) ? formError.length : formError);
  return props.invalid || hasFormError;
});

const valid = computed(
  () => !invalid.value && (props.disabled ? null : validityData.value.state.valid),
);

const state = computed<FieldRootState>(() => ({
  disabled: props.disabled,
  touched: touched.value,
  dirty: dirty.value,
  valid: valid.value,
  filled: filled.value,
  focused: focused.value,
}));

provide(FieldRootContext, {
  ...DEFAULT_FIELD_ROOT_CONTEXT,
  invalid,
  name: effectiveName,
  disabled: computed(() => props.disabled),
  validityData,
  setValidityData,
  setTouched(next) {
    touched.value = next;
  },
  setDirty(next) {
    dirty.value = next;
  },
  setFilled(next) {
    filled.value = next;
  },
  setFocused(next) {
    focused.value = next;
  },
  focusOwnerRef,
  state,
  registerFieldControl,
  validation: { ...DEFAULT_FIELD_ROOT_CONTEXT.validation, change, commit },
});

function elementProps() {
  return { ...getStateAttributesProps(state.value, fieldValidityMapping), ...attrs };
}

defineExpose({ validate, validityData, registeredFieldName });
</script>

<template>
  <div v-bind="elementProps()"><slot /></div>
</template>
