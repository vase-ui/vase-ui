<script setup lang="ts">
import { computed, provide, shallowRef, useAttrs } from 'vue';
import { DEFAULT_VALIDITY_STATE, fieldValidityMapping } from '../../src/internals/field-constants';
import {
  DEFAULT_FIELD_ROOT_CONTEXT,
  FieldRootContext,
} from '../../src/internals/field-root-context/FieldRootContext';
import type {
  FieldRootState,
  FieldValidityData,
} from '../../src/internals/field-root-context/FieldRootContext';
import { getStateAttributesProps } from '../../src/internals/getStateAttributesProps';

defineOptions({ inheritAttrs: false });

const props = withDefaults(
  defineProps<{
    invalid?: boolean | undefined;
    disabled?: boolean | undefined;
  }>(),
  { invalid: false, disabled: false },
);

const attrs = useAttrs();

const touched = shallowRef(false);
const dirty = shallowRef(false);
const filled = shallowRef(false);
const focused = shallowRef(false);
const focusOwnerRef = shallowRef<unknown>();
const validityData = shallowRef<FieldValidityData>({
  state: DEFAULT_VALIDITY_STATE,
  error: '',
  errors: [],
  value: null,
  initialValue: null,
});

const valid = computed(
  () => !props.invalid && (props.disabled ? null : validityData.value.state.valid),
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
  invalid: computed(() => props.invalid),
  disabled: computed(() => props.disabled),
  validityData,
  setValidityData(next) {
    validityData.value = next;
  },
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
});

function elementProps() {
  return { ...getStateAttributesProps(state.value, fieldValidityMapping), ...attrs };
}
</script>

<template>
  <div v-bind="elementProps()"><slot /></div>
</template>
