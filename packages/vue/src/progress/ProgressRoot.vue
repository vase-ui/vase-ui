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
import { progressKey, statusAttributes } from './root';
import type { ProgressRootProps, ProgressRootState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ProgressRootProps>(), {
  value: null,
  min: 0,
  max: 100,
  locale: 'en-US',
});
defineSlots<{
  default?(scope: { state: ProgressRootState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ProgressRootState;
  }): unknown;
}>();

const attrs = useAttrs();
const labelId = useId();
const { element, setElement } = useElement<HTMLDivElement>();
const labels = shallowReactive<{ readonly id: string }[]>([]);
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));

// The status, `aria-valuenow`, the text and the width read one value in the range.
const valueInRange = computed(() =>
  props.value != null && Number.isFinite(props.value)
    ? clamp(props.value, props.min, props.max)
    : null,
);
const percent = computed(() =>
  valueInRange.value === null ? null : percentOf(valueInRange.value),
);
const formatter = computed(
  () => new Intl.NumberFormat(props.locale, props.format ?? { style: 'percent' }),
);
const formattedValue = computed(() => {
  const value = valueInRange.value;
  if (value === null) return null;
  return formatter.value.format(props.format ? value : percentOf(value) / 100);
});
const state = computed<ProgressRootState>(() => ({
  status:
    valueInRange.value === null
      ? 'indeterminate'
      : valueInRange.value === props.max
        ? 'complete'
        : 'progressing',
}));

provide(progressKey, {
  get state() {
    return state.value;
  },
  get value() {
    return props.value;
  },
  get formattedValue() {
    return formattedValue.value;
  },
  get percent() {
    return percent.value;
  },
  labelId,
  addLabel(label) {
    labels.push(label);
    return () => labels.splice(labels.indexOf(label), 1);
  },
});

defineExpose({ element });

// The value is in the range, so the percent is from 0 to 100. With `max` equal to `min`, it is 0.
function percentOf(value: number) {
  return ((value - props.min) / (props.max - props.min)) * 100 || 0;
}

// A server writes the attributes of the root before the `setup` of a label in it, so the root
// assumes a label until the mount.
function labelledBy() {
  // An `aria-labelledby` of the developer wins in the merge.
  if (attrs['aria-label'] != null) return undefined;
  return labels[0]?.id ?? (mounted.value ? undefined : labelId);
}

function elementProps() {
  return mergeProps(
    {
      role: 'progressbar',
      'aria-valuemin': props.min,
      'aria-valuemax': props.max,
      'aria-valuenow': valueInRange.value ?? undefined,
      'aria-valuetext': props.getAriaValueText
        ? props.getAriaValueText(formattedValue.value ?? '', props.value)
        : (formattedValue.value ?? undefined),
      'aria-labelledby': labelledBy(),
      ...statusAttributes(state.value),
    },
    attrs,
  );
}
</script>

<!-- NVDA and JAWS can need text in a progress bar to say its name: the hidden node gives it.
https://github.com/mui/base-ui/issues/4184 -->
<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <span role="presentation" :style="visuallyHidden">x</span>
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
    <span role="presentation" :style="visuallyHidden">x</span>
  </div>
</template>
