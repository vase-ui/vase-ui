<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderTrackState extends SliderRootState {}

export interface SliderTrackProps
  extends
    VaseUIComponentProps<SliderTrackState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderTrackProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderTrackState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderTrackState>;
}>();

const { state } = useSliderRootContext();

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ style: { position: 'relative' } }, attrs],
  stateAttributesMapping: sliderStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
