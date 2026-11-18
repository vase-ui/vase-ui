<script setup lang="ts">
import { computed } from 'vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useMeterRootContext } from '../root/MeterRootContext';

defineSlots<{
  default?(props: { formattedValue: string; value: number }): unknown;
}>();

const { clampedValue, percentageValue, props } = useMeterRootContext();

// This part resolves the locale itself, because it can hydrate after the root, for example in an
// async component in `<Suspense>`.
const formatLocale = useFormatLocale(() => props.locale);
const formattedValue = computed(() =>
  formatRangeValue(clampedValue.value, percentageValue.value, formatLocale.value, props.format),
);

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" :formatted-value="formattedValue" :value="props.value" />
  <template v-else>{{ formattedValue }}</template>
</template>
