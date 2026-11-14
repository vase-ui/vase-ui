<script lang="ts">
import type { OutputHTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderValueState extends SliderRootState {}

export interface SliderValueProps
  extends
    VaseUIComponentProps<SliderValueState>,
    /* @vue-ignore */ WithVaseUIEvent<OutputHTMLAttributes> {}
</script>

<script setup lang="ts">
import type { Component } from 'vue';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import SliderValueChildren from './SliderValueChildren.vue';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderValueProps>(), { as: 'output' });

defineSlots<{
  default(props: {
    formattedValues: readonly string[];
    values: readonly number[];
    state: SliderValueState;
  }): unknown;
  render(props: { props: HTMLProps; state: SliderValueState; children: Component }): unknown;
}>();

const { thumbMap, state } = useSliderRootContext();

const { element, elementProps } = useRenderElement('output', props, {
  state,
  props: (attrs) => [
    {
      // off by default because it will keep announcing when the slider is being dragged
      // and also when the value is changing (but not yet committed)
      'aria-live': 'off',
      for:
        Array.from(thumbMap.value.values(), ({ inputId }) => inputId)
          .join(' ')
          .trim() || undefined,
    },
    attrs,
  ],
  stateAttributesMapping: sliderStateAttributesMapping,
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="SliderValueChildren" />
  <component :is="as" v-else v-bind="elementProps()"><SliderValueChildren><template v-if="$slots.default" #default="content"><slot v-bind="content" :state="state" /></template></SliderValueChildren></component>
</template>
