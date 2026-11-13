<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderIndicatorState extends SliderRootState {}

export interface SliderIndicatorProps
  extends
    VaseUIComponentProps<SliderIndicatorState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}

function getIndicatorStyles(
  vertical: boolean,
  range: boolean,
  inset: boolean,
  start: number | undefined,
  end: number | undefined,
  forceHidden: boolean,
) {
  const styles: Record<string, string | number | undefined> = {
    visibility:
      forceHidden || (inset && (start === undefined || (range && end === undefined)))
        ? 'hidden'
        : undefined,
    position: vertical ? 'absolute' : 'relative',
    [vertical ? 'width' : 'height']: 'inherit',
  };

  let startValue = `${start ?? 0}%`;
  let sizeValue = `${(end ?? 0) - (start ?? 0)}%`;

  if (inset) {
    styles['--start-position'] = startValue;
    startValue = 'var(--start-position)';

    if (range) {
      styles['--relative-size'] = sizeValue;
      sizeValue = 'var(--relative-size)';
    }
  }

  styles[vertical ? 'bottom' : 'insetInlineStart'] = range ? startValue : 0;
  styles[vertical ? 'height' : 'width'] = range ? sizeValue : startValue;

  return styles;
}
</script>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { valueToPercent } from '../../utils/valueToPercent';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderIndicatorProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderIndicatorState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderIndicatorState>;
}>();

const { indicatorPosition, inset, max, min, orientation, renderBeforeHydration, state, values } =
  useSliderRootContext();

const isHydrating = useIsHydrating();

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => {
    const isInset = inset.value;
    const sliderValues = values.value;
    return [
      {
        'data-vase-ui-slider-indicator': renderBeforeHydration.value ? '' : undefined,
        style: getIndicatorStyles(
          orientation.value === 'vertical',
          sliderValues.length > 1,
          isInset,
          isInset
            ? indicatorPosition.value[0]
            : valueToPercent(sliderValues[0], min.value, max.value),
          isInset
            ? indicatorPosition.value[1]
            : valueToPercent(sliderValues[sliderValues.length - 1], min.value, max.value),
          isInset && renderBeforeHydration.value && isHydrating.value,
        ),
        // The script of the server HTML writes the position to the style.
        'data-allow-mismatch':
          renderBeforeHydration.value && isHydrating.value ? 'style' : undefined,
      },
      attrs,
    ];
  },
  stateAttributesMapping: sliderStateAttributesMapping,
});

// For a range, the script of the server HTML also writes `--end-position`. No render has that
// property, so the hydrated indicator differs from the indicator of a client-only render.
onMounted(() => {
  if (renderBeforeHydration.value) {
    element.value?.style.removeProperty('--end-position');
  }
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
