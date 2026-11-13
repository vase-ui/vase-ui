<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot.vue';

export interface NumberFieldGroupState extends NumberFieldRootState {}

export interface NumberFieldGroupProps
  extends
    VaseUIComponentProps<NumberFieldGroupState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldGroupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: NumberFieldGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldGroupState>;
}>();

const { state } = useNumberFieldRootContext();

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'group' }, attrs],
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
