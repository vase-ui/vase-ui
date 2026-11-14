<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type ComboboxLabelState = FieldRootState;

export interface ComboboxLabelProps
  extends
    VaseUIComponentProps<ComboboxLabelState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {}
</script>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { error } from '../../common/error';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context';
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

const { state } = useFieldRootContext();
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
  fallbackControlId: () =>
    store.select('triggerElement')?.id ?? (inputInsidePopup.value ? store.select('id') : undefined),
  registerLabelId: store.context.registerLabelId,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: fieldValidityMapping,
  // The id derives from the root, so an `id` of the consumer does not replace it.
  props: ({ id: _id, ...attrs }) => [labelProps.value, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
