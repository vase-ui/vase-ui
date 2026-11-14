<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../internals/field-root-context/FieldRootContext';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type SelectLabelState = FieldRootState;

export interface SelectLabelProps
  extends
    VaseUIComponentProps<SelectLabelState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {}
</script>

<script setup lang="ts">
import { fieldValidityMapping } from '../../internals/field-constants';
import { useFieldRootContext } from '../../internals/field-root-context';
import { useLabel } from '../../internals/labelable-provider';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { getDefaultLabelId } from '../../utils/resolveAriaLabelledBy';
import { useSelectRootContext } from '../root/SelectRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SelectLabelProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SelectLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, SelectLabelState>;
}>();

const { state } = useFieldRootContext();
const store = useSelectRootContext();

const labelProps = useLabel({
  id: () => getDefaultLabelId(store.select('id')),
  fallbackControlId: () => store.select('triggerElement')?.id ?? store.select('id'),
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
