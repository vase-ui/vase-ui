<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ComboboxGroupLabelState {}

export interface ComboboxGroupLabelProps
  extends
    VaseUIComponentProps<ComboboxGroupLabelState>,
    /* @vue-ignore */ Omit<WithVaseUIEvent<HTMLAttributes>, 'id'> {
  /**
   * The id of the label. The group uses it for `aria-labelledby`.
   */
  id?: string | undefined;
}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import { useRegisteredId } from '../../internals/labelable-provider/useRegisteredId';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useVaseUiId } from '../../internals/useVaseUiId';
import { useRenderElement } from '../../internals/useRenderElement';
import { useComboboxGroupContext } from '../group/ComboboxGroupContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ComboboxGroupLabelProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ComboboxGroupLabelState }): unknown;
  render: ComponentRenderFn<HTMLProps, ComboboxGroupLabelState>;
}>();

const { registerLabelId } = useComboboxGroupContext();

const labelId = useVaseUiId(() => props.id);

useRegisteredId(
  () => labelId.value,
  registerLabelId,
  () => element.value,
);

const state: ComboboxGroupLabelState = EMPTY_OBJECT;

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ id: labelId.value, 'aria-hidden': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
