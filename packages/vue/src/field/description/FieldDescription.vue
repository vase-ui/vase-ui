<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface FieldDescriptionState extends FieldRootState {}

export interface FieldDescriptionProps
  extends
    VaseUIComponentProps<FieldDescriptionState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The `id` of the description. The control of the field names it in `aria-describedby`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useRegisteredMessageId } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldDescriptionProps>(), { as: 'p' });

defineSlots<{
  default(props: { state: FieldDescriptionState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldDescriptionState>;
}>();

const descriptionId = useVaseUiId(() => props.id);

const { state: fieldState, disabled: fieldDisabled } = useFieldRootContext(false);
const { disabled: itemDisabled } = useFieldItemContext();

const state = computed<FieldDescriptionState>(() => ({
  ...fieldState.value,
  disabled: fieldDisabled.value || itemDisabled.value,
}));

useRegisteredMessageId(descriptionId, () => element.value);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('p', props, {
  state,
  props: (attrs) => [{ id: descriptionId.value }, attrs],
  stateAttributesMapping: fieldValidityMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
