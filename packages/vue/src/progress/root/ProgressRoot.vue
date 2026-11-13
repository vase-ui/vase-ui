<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export type ProgressStatus = 'indeterminate' | 'progressing' | 'complete';

export interface ProgressRootState {
  /**
   * The current status.
   */
  status: ProgressStatus;
}

export interface ProgressRootProps
  extends
    VaseUIComponentProps<ProgressRootState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Options to format the value.
   */
  format?: Intl.NumberFormatOptions | undefined;
  /**
   * Accepts a function which returns a string value that provides a human-readable text alternative for the current value of the progress bar.
   */
  getAriaValueText?: ((formattedValue: string, value: number | null) => string) | undefined;
  /**
   * The locale used by `Intl.NumberFormat` when formatting the value.
   * Defaults to the user's runtime locale.
   * When server rendering, `en-US` is used until hydration.
   */
  locale?: Intl.LocalesArgument | undefined;
  /**
   * The maximum value.
   * @default 100
   */
  max?: number | undefined;
  /**
   * The minimum value.
   * @default 0
   */
  min?: number | undefined;
  /**
   * The current value. The component is indeterminate when value is `null`.
   */
  value: number | null;
}
</script>

<script setup lang="ts">
import { computed, provide } from 'vue';
import type { Component } from 'vue';
import { clamp } from '../../common/clamp';
import type { HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useLabelId } from '../../utils/useRegisteredLabelId';
import { valueToPercent } from '../../utils/valueToPercent';
import ProgressRootChildren from './ProgressRootChildren.vue';
import { ProgressRootContext } from './ProgressRootContext';
import { progressStateAttributesMapping } from './stateAttributesMapping';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ProgressRootProps>(), {
  as: 'div',
  max: 100,
  min: 0,
});

defineSlots<{
  default(props: { state: ProgressRootState }): unknown;
  render(props: { props: HTMLProps; state: ProgressRootState; children: Component }): unknown;
}>();

const formatLocale = useFormatLocale(() => props.locale);
const { defaultLabelId, setLabelId, getAriaLabelledBy } = useLabelId();

// A `null` or non-finite value keeps the progress indeterminate.
// Otherwise one clamped value and one percentage feed every output: the status, `aria-valuenow`,
// the text and the width of the indicator.
// The outputs then agree for each `min` and `max`, not only for 0 and 100.
const finiteValue = computed(() =>
  props.value != null && Number.isFinite(props.value) ? props.value : null,
);

const percentageValue = computed(() => {
  if (finiteValue.value === null) {
    return null;
  }
  const rawPercentage = valueToPercent(finiteValue.value, props.min, props.max);
  return clamp(Number.isNaN(rawPercentage) ? 0 : rawPercentage, 0, 100);
});

const clampedValue = computed(() =>
  finiteValue.value === null ? null : clamp(finiteValue.value, props.min, props.max),
);

const status = computed<ProgressStatus>(() => {
  if (clampedValue.value === null) {
    return 'indeterminate';
  }
  return clampedValue.value === props.max ? 'complete' : 'progressing';
});

const state = computed<ProgressRootState>(() => ({ status: status.value }));

// The text uses the clamped value, so that the visible and the accessible text agree with
// `aria-valuenow` and the indicator. The raw value is the second argument of `getAriaValueText`.
const formattedValue = computed(() =>
  formatRangeValue(clampedValue.value, percentageValue.value, formatLocale.value, props.format),
);

const ariaValueText = computed(() => {
  if (props.getAriaValueText) {
    return props.getAriaValueText(formattedValue.value, props.value);
  }
  return status.value === 'indeterminate' ? 'indeterminate progress' : formattedValue.value;
});

provide(ProgressRootContext, {
  clampedValue,
  format: computed(() => props.format),
  locale: computed(() => props.locale),
  percentageValue,
  value: computed(() => props.value),
  setLabelId,
  defaultLabelId,
  state,
});

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      'aria-labelledby': getAriaLabelledBy(attrs),
      'aria-valuemax': props.max,
      'aria-valuemin': props.min,
      'aria-valuenow': clampedValue.value ?? undefined,
      'aria-valuetext': ariaValueText.value,
      role: 'progressbar',
    },
    attrs,
  ],
  stateAttributesMapping: progressStateAttributesMapping,
  children: true,
});

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ProgressRootChildren" />
  <component :is="as" v-else v-bind="elementProps()"><ProgressRootChildren><slot :state="state" /></ProgressRootChildren></component>
</template>
