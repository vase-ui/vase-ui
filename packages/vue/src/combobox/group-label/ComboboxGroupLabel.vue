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
import { useVaseUiId } from '../../internals/useBaseUiId';
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

const source = Symbol();

useRegisteredId(
  () => labelId.value,
  (getId) => registerLabelId(source, getId),
);

const state: ComboboxGroupLabelState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ id: labelId.value, 'aria-hidden': true }, attrs],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
