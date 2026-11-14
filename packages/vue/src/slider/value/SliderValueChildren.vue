<script setup lang="ts">
import { computed } from 'vue';
import { formatNumber } from '../../common/formatNumber';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useSliderRootContext } from '../root/SliderRootContext';

defineSlots<{
  default?(props: { formattedValues: readonly string[]; values: readonly number[] }): unknown;
}>();

const { values, format, locale } = useSliderRootContext();

// This part resolves the locale itself, because it can hydrate after the root, for example in an
// async component in `<Suspense>`.
const formatLocale = useFormatLocale(locale);

const formattedValues = computed(() =>
  values.value.map((value) => formatNumber(value, formatLocale.value, format.value)),
);

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" :formatted-values="formattedValues" :values="values" />
  <template v-else-if="formattedValues.length > 0">{{ formattedValues.join(' – ') }}</template>
</template>
