<script setup lang="ts">
import { computed } from 'vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { formatRangeValue } from '../../utils/formatRangeValue';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useProgressRootContext } from '../root/ProgressRootContext';

defineSlots<{
  default?(props: { formattedValue: string | null; value: number | null }): unknown;
}>();

const { clampedValue, format, locale, percentageValue, value, state } = useProgressRootContext();

// This part resolves the locale itself, because it can hydrate after the root, for example in an
// async component in `<Suspense>`.
const formatLocale = useFormatLocale(locale);
const formattedValue = computed(() =>
  formatRangeValue(clampedValue.value, percentageValue.value, formatLocale.value, format.value),
);

// The status decides, because a non-finite value is also indeterminate and has no text to show.
const indeterminate = computed(() => state.value.status === 'indeterminate');

markChildrenMounted();
</script>

<template>
  <slot
    v-if="$slots.default"
    :formatted-value="indeterminate ? 'indeterminate' : formattedValue"
    :value="value"
  />
  <template v-else-if="!indeterminate">{{ formattedValue }}</template>
</template>
