<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface MeterRootState {}

export interface MeterRootProps
  extends VaseUIComponentProps<MeterRootState>, /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * A function that returns a string value that provides a human-readable text alternative for `aria-valuenow`, the current value of the meter.
   */
  getAriaValueText?: ((formattedValue: string, value: number) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value.
   */
  value: number;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { Component } from 'vue';
import { clamp } from '../../common/clamp';
import { EMPTY_OBJECT } from '../../common/empty';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useLabelId } from '../../utils/useRegisteredLabelId';
import { valueToPercent } from '../../utils/valueToPercent';
import MeterRootChildren from './MeterRootChildren.vue';
import { MeterRootContext } from './MeterRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MeterRootProps>(), {
  as: 'div',
  max: 100,
  min: 0,
});

defineSlots<{
  default(props: { state: MeterRootState }): unknown;
  render(props: { props: HTMLProps; state: MeterRootState; children: Component }): unknown;
}>();

const state: MeterRootState = EMPTY_OBJECT;

const formatLocale = useFormatLocale(() => props.locale);
const { defaultLabelId, setLabelId, getAriaLabelledBy } = useLabelId();

// `clamp` handles infinity. `NaN` needs a fallback, because `Math.min(NaN, max)` is `NaN`.
const percentageValue = computed(() => {
  const rawPercentage = valueToPercent(props.value, props.min, props.max);
  return clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
});

const clampedValue = computed(() =>
  clamp(Number.isNaN(props.value) ? props.min : props.value, props.min, props.max),
);

// The text uses the clamped value, so that the visible and the accessible text agree with
// `aria-valuenow` and the indicator. The raw value is the second argument of `getAriaValueText`.
const formattedValue = computed(() =>
  formatRangeValue(clampedValue.value, percentageValue.value, formatLocale.value, props.format),
);

const ariaValueText = computed(() =>
  props.getAriaValueText
    ? props.getAriaValueText(formattedValue.value, props.value)
    : formattedValue.value,
);

provide(MeterRootContext, {
  clampedValue,
  format: computed(() => props.format),
  locale: computed(() => props.locale),
  percentageValue,
  value: computed(() => props.value),
  setLabelId,
  defaultLabelId,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      'aria-labelledby': getAriaLabelledBy(attrs),
      'aria-valuemax': props.max,
      'aria-valuemin': props.min,
      'aria-valuenow': clampedValue.value,
      'aria-valuetext': ariaValueText.value,
      role: 'meter',
    },
    attrs,
  ],
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="MeterRootChildren" />
  <component :is="as" v-else v-bind="elementProps()"><MeterRootChildren><slot :state="state" /></MeterRootChildren></component>
</template>
