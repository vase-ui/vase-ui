<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { MeterRootState } from '../root/MeterRoot.vue';

export interface MeterIndicatorState extends MeterRootState {}

export interface MeterIndicatorProps
  extends
    VaseUIComponentProps<MeterIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMeterRootContext } from '../root/MeterRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MeterIndicatorProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MeterIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, MeterIndicatorState>;
}>();

const { percentageValue } = useMeterRootContext();

const state: MeterIndicatorState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    { style: { insetInlineStart: 0, height: 'inherit', width: `${percentageValue.value}%` } },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
