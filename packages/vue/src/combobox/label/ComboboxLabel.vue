<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../field/types';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type ComboboxLabelState = FieldRootState;

export interface ComboboxLabelProps
  extends
    VaseUIComponentProps<ComboboxLabelState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {}
</script>

<script setup lang="ts">
import { computed, inject, onMounted, watch } from 'vue';
import { error } from '../../common/error';
import { fieldKey } from '../../field/control';
import { DEFAULT_FIELD_ROOT_STATE, fieldValidityMapping } from '../../internals/field-constants';
import { useLabel } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxLabelProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxLabelState>;
}>();

const field = inject(fieldKey, null);
const state = computed<ComboboxLabelState>(() =>
  field ? { ...field.state, disabled: field.disabled } : DEFAULT_FIELD_ROOT_STATE,
);
const store = useComboboxRootContext();

const inputInsidePopup = computed(() => store.select('inputInsidePopup'));

if (process.env.NODE_ENV !== 'production') {
  const inputElement = computed(() => store.select('inputElement'));
  const warnWhenTheInputIsTheControl = () => {
    if (inputElement.value && !inputInsidePopup.value) {
      error(
        '<Combobox.Label> labels <Combobox.Trigger> only, and <Combobox.Input> is the form control of this combobox.',
        'The input thus has no label.',
        'Use a native <label> or <Field.Label> for the input.',
      );
    }
  };
  onMounted(warnWhenTheInputIsTheControl);
  watch([inputElement, inputInsidePopup], warnWhenTheInputIsTheControl);
}

const labelProps = useLabel({
  id: () => getDefaultLabelId(store.select('id')),
  element: () => element.value,
  fallbackControlId: () =>
    store.select('triggerElement')?.id ?? (inputInsidePopup.value ? store.select('id') : undefined),
  // While the input is outside the popup, the input is the control of a field.
  controlElement: () => (inputInsidePopup.value ? store.select('triggerElement') : null),
  registerLabelId: store.context.registerLabelId,
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
  // The id derives from the root, so an `id` of the consumer does not replace it.
  props: ({ id: _id, ...attrs }) => [labelProps.value, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
