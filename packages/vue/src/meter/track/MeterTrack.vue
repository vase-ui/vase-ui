<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { MeterRootState } from '../root/MeterRoot.vue';

export interface MeterTrackState extends MeterRootState {}

export interface MeterTrackProps
  extends
    VaseUIComponentProps<MeterTrackState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { EMPTY_OBJECT } from '../../common/empty';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MeterTrackProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: MeterTrackState }): unknown;
  render: ComponentRenderFn<HTMLProps, MeterTrackState>;
}>();

const state: MeterTrackState = EMPTY_OBJECT;

const { element, elementProps } = useRenderElement('div', props, { state });

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
