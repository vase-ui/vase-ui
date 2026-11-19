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
import { sliderStateAttributesMapping, useSliderRootContext } from '../root/SliderRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderTrackProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderTrackState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderTrackState>;
}>();

const { state } = useSliderRootContext();

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [{ style: { position: 'relative' } }, attrs],
  stateAttributesMapping: sliderStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
