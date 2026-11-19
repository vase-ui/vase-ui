<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderIndicatorState extends SliderRootState {}

export interface SliderIndicatorProps
  extends
    VaseUIComponentProps<SliderIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import { sliderStateAttributesMapping, useSliderRootContext } from '../root/SliderRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderIndicatorProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderIndicatorState>;
}>();

const {
  props: rootProps,
  indicatorPosition,
  inset,
  renderBeforeHydration,
  state,
  values,
} = useSliderRootContext();

const isHydrating = useIsHydrating();

const scriptSetsStyle = computed(() => renderBeforeHydration.value && isHydrating.value);
const style = computed(() => {
  const vertical = rootProps.orientation === 'vertical';
  const range = values.value.length > 1;
  const [start, end] = inset.value
    ? indicatorPosition
    : [
        valueToPercent(values.value[0] ?? NaN, rootProps.min, rootProps.max),
        valueToPercent(values.value.at(-1) ?? NaN, rootProps.min, rootProps.max),
      ];
  const offset = `${start ?? 0}%`;
  const size = `${(end ?? 0) - (start ?? 0)}%`;
  const startPosition = inset.value ? 'var(--start-position)' : offset;
  const rangeSize = inset.value ? 'var(--relative-size)' : size;
  return {
    visibility:
      inset.value && (scriptSetsStyle.value || start === undefined || (range && end === undefined))
        ? 'hidden'
        : undefined,
    position: vertical ? 'absolute' : 'relative',
    [vertical ? 'width' : 'height']: 'inherit',
    '--start-position': inset.value ? offset : undefined,
    '--relative-size': inset.value && range ? size : undefined,
    [vertical ? 'bottom' : 'insetInlineStart']: range ? startPosition : 0,
    [vertical ? 'height' : 'width']: range ? rangeSize : startPosition,
  };
});

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      'data-vase-ui-slider-indicator': renderBeforeHydration.value ? '' : undefined,
      'data-allow-mismatch': scriptSetsStyle.value ? 'style' : undefined,
      style: style.value,
    },
    attrs,
  ],
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
