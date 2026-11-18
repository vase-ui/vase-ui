<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ProgressRootState } from '../root/ProgressRoot.vue';

export interface ProgressIndicatorState extends ProgressRootState {}

export interface ProgressIndicatorProps
  extends
    VaseUIComponentProps<ProgressIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  progressStateAttributesMapping,
  useProgressRootContext,
} from '../root/ProgressRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ProgressIndicatorProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ProgressIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, ProgressIndicatorState>;
}>();

const { percentageValue, state } = useProgressRootContext();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    percentageValue.value == null
      ? undefined
      : { style: { insetInlineStart: 0, height: 'inherit', width: `${percentageValue.value}%` } },
    attrs,
  ],
  stateAttributesMapping: progressStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
