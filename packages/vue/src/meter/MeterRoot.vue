<script setup lang="ts">
import {
  computed,
  mergeProps,
  onMounted,
  provide,
  shallowReactive,
  shallowRef,
  useAttrs,
  useId,
} from 'vue';
import { clamp } from '../common/clamp';
import { useElement } from '../common/element';
import { visuallyHidden } from '../common/visuallyHidden';
import { useLocale } from '../locale-provider/part';
import { meterKey } from './root';
import type { MeterRootProps } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<MeterRootProps>(), { min: 0, max: 100 });
defineSlots<{
  default?(): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
  }): unknown;
}>();

const attrs = useAttrs();
const labelId = useId();
const { element, setElement } = useElement<HTMLDivElement>();
const textLocale = useLocale(() => props.locale);

// `aria-valuenow` must not leave the range (WAI-ARIA 1.2, `meter`), and `NaN` is in no range.
const heldValue = computed(() =>
  clamp(Number.isNaN(props.value) ? props.min : props.value, props.min, props.max),
);
// A range with `max` equal to `min` gives `NaN`.
const percent = computed(
  () => ((heldValue.value - props.min) / (props.max - props.min)) * 100 || 0,
);
const formatter = computed(
  () => new Intl.NumberFormat(textLocale.value, props.format ?? { style: 'percent' }),
);
const formattedValue = computed(() =>
  formatter.value.format(props.format ? heldValue.value : percent.value / 100),
);

const labels = shallowReactive<{ readonly id: string }[]>([]);
// A server writes the attributes of the root before the `setup` of a label, so the root assumes a
// label until the mount.
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));

provide(meterKey, {
  get value() {
    return props.value;
  },
  get percent() {
    return percent.value;
  },
  get formattedValue() {
    return formattedValue.value;
  },
  labelId,
  addLabel(label) {
    labels.push(label);
    return () => labels.splice(labels.indexOf(label), 1);
  },
});

defineExpose({ element });

function labelledBy() {
  if (attrs['aria-label'] != null) return undefined;
  return labels[0]?.id ?? (mounted.value ? undefined : labelId);
}

function elementProps() {
  return mergeProps(
    {
      role: 'meter',
      'aria-valuemin': props.min,
      'aria-valuemax': props.max,
      'aria-valuenow': heldValue.value,
      'aria-valuetext': props.getAriaValueText
        ? props.getAriaValueText(formattedValue.value, props.value)
        : formattedValue.value,
      'aria-labelledby': labelledBy(),
    },
    attrs,
  );
}
</script>

<!-- NVDA and JAWS can need text in a meter to say its name: the hidden node gives it.
https://github.com/mui/base-ui/issues/4184 -->
<template>
  <slot v-if="$slots.element" name="element" :props="elementProps()" :elementRef="setElement" />
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot />
    <span role="presentation" :style="visuallyHidden">x</span>
  </div>
</template>
