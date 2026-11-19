<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { FieldRootState } from '../../field/types';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type SelectLabelState = FieldRootState;

export interface SelectLabelProps
  extends
    VaseUIComponentProps<SelectLabelState>,
    /* @vue-ignore */ WithVaseUIEvent<Omit<HTMLAttributes, 'id'>> {}
</script>

<script setup lang="ts">
import { computed, inject } from 'vue';
import { fieldKey } from '../../field/control';
import { DEFAULT_FIELD_ROOT_STATE, fieldValidityMapping } from '../../internals/field-constants';
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

const field = inject(fieldKey, null);
const state = computed<SelectLabelState>(() =>
  field ? { ...field.state, disabled: field.disabled } : DEFAULT_FIELD_ROOT_STATE,
);
const store = useSelectRootContext();

const labelProps = useLabel({
  id: () => getDefaultLabelId(store.select('id')),
  element: () => element.value,
  controlElement: () => store.select('triggerElement'),
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
