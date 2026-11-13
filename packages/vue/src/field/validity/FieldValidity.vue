<script lang="ts">
import type { FieldValidityData } from '../../internals/field-root-context/FieldRootContext';
import type { TransitionStatus } from '../../internals/useTransitionStatus';

export interface FieldValidityState extends Omit<FieldValidityData, 'state'> {
  /**
   * The validity state.
   */
  validity: FieldValidityData['state'];
  /**
   * The transition status of the component.
   */
  transitionStatus: TransitionStatus;
}

export interface FieldValidityProps {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useFieldRootContext } from '../../internals/field-root-context';
import { getCombinedFieldValidityData } from '../../internals/field-root-context/getCombinedFieldValidityData';
import { useTransitionStatus } from '../../internals/useTransitionStatus';

defineSlots<{
  /**
   * The content. It gets the field validity state as its slot props.
   *
   * ```vue
   * <Field.Validity v-slot="{ validity }">
   *   <div>...</div>
   * </Field.Validity>
   * ```
   */
  default(props: FieldValidityState): unknown;
}>();

const { validityData, invalid } = useFieldRootContext(false);

const combinedFieldValidityData = computed(() =>
  getCombinedFieldValidityData(validityData.value, invalid.value),
);
const { transitionStatus } = useTransitionStatus(
  () => combinedFieldValidityData.value.state.valid === false,
);

// The object stays the same until the validity changes. A child component that gets it as a prop
// then renders again only for a change of the validity, and not for a change of the focus, of the
// dirty state or of the filled state.
const fieldValidityState = computed<FieldValidityState>(() => {
  const { state, ...rest } = combinedFieldValidityData.value;
  return { ...rest, validity: state, transitionStatus: transitionStatus.value };
});
</script>

<template>
  <slot v-bind="fieldValidityState" />
</template>
