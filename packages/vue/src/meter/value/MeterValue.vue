<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { MeterRootState } from '../root/MeterRoot.vue';

export interface MeterValueState extends MeterRootState {}

export interface MeterValueProps
  extends
    VaseUIComponentProps<MeterValueState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import MeterValueChildren from './MeterValueChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MeterValueProps>(), { as: 'span' });

defineSlots<{
  default(props: { formattedValue: string; value: number; state: MeterValueState }): unknown;
  render(props: { props: HTMLProps; state: MeterValueState; children: Component }): unknown;
}>();

const state: MeterValueState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('span', props, {
  state,
  props: (attrs) => [{ 'aria-hidden': true }, attrs],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="MeterValueChildren" />
  <component :is="as" v-else v-bind="elementProps()"><MeterValueChildren><template v-if="$slots.default" #default="content"><slot v-bind="content" :state="state" /></template></MeterValueChildren></component>
</template>
