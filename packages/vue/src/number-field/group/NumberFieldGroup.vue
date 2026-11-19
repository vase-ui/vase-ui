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
import { useNumberFieldRootContext, stateAttributesMapping } from '../root/NumberFieldRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldGroupProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: NumberFieldGroupState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldGroupState>;
}>();

const { state } = useNumberFieldRootContext();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ role: 'group' }, attrs],
  stateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
