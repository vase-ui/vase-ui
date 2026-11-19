<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { ProgressRootState } from '../root/ProgressRoot.vue';

export interface ProgressTrackState extends ProgressRootState {}

export interface ProgressTrackProps
  extends
    VaseUIComponentProps<ProgressTrackState>,
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

const props = withDefaults(defineProps<ProgressTrackProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ProgressTrackState }): unknown;
  render: ComponentRenderFn<HTMLProps, ProgressTrackState>;
}>();

const { state } = useProgressRootContext();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
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
