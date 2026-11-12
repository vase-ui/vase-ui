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
import { useProgressRootContext } from '../root/ProgressRootContext';
import { progressStateAttributesMapping } from '../root/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ProgressTrackProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: ProgressTrackState }): unknown;
  render: ComponentRenderFn<HTMLProps, ProgressTrackState>;
}>();

const { state } = useProgressRootContext();

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping: progressStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
