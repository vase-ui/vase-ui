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
import { useVaseUiId } from '../../internals/useBaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFieldItemContext } from '../item/FieldItemContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<FieldDescriptionProps>(), { as: 'p' });

defineSlots<{
  default(props: { state: FieldDescriptionState }): unknown;
  render: ComponentRenderFn<HTMLProps, FieldDescriptionState>;
}>();

const descriptionId = useVaseUiId(() => props.id);

const fieldRootContext = useFieldRootContext(false);
const fieldItemContext = useFieldItemContext();

const state = computed<FieldDescriptionState>(() => ({
  ...fieldRootContext.state.value,
  disabled: (fieldRootContext.disabled.value ?? false) || fieldItemContext.disabled.value,
}));

useRegisteredMessageId(descriptionId);

const { element, elementProps } = useRenderElement('p', props, {
  state,
  props: (attrs) => [{ id: descriptionId.value }, attrs],
  stateAttributesMapping: fieldValidityMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
