<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ProgressRootState } from '../root/ProgressRoot.vue';

export interface ProgressValueState extends ProgressRootState {}

export interface ProgressValueProps
  extends
    VaseUIComponentProps<ProgressValueState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  progressStateAttributesMapping,
  useProgressRootContext,
} from '../root/ProgressRootContext';
import ProgressValueChildren from './ProgressValueChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ProgressValueProps>(), { as: 'span' });

defineSlots<{
  default(props: {
    formattedValue: string | null;
    value: number | null;
    state: ProgressValueState;
  }): unknown;
  render(props: { props: HTMLProps; state: ProgressValueState; children: Component }): unknown;
}>();

const { state } = useProgressRootContext();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
  state,
  props: (attrs) => [{ 'aria-hidden': true }, attrs],
  stateAttributesMapping: progressStateAttributesMapping,
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" :children="ProgressValueChildren" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <ProgressValueChildren><template v-if="$slots.default" #default="content"><slot v-bind="content" :state="state" /></template></ProgressValueChildren>
  </component>
</template>
