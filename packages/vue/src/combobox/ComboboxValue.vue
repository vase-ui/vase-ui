<script setup lang="ts">
import { computed } from 'vue';
import {
  hasNullItemLabel,
  resolveMultipleLabels,
  resolveSelectedLabel,
  type ItemLabel,
} from '../common/resolveValueLabel';
import { injectComboboxRoot } from './root';
import type { ComboboxValueProps } from './types';

const props = defineProps<ComboboxValueProps>();
defineSlots<{
  /** Formats the value. With `multiple`, the value is a list that the part can share: read it only. */
  default?(scope: { value: any }): unknown;
}>();

const context = injectComboboxRoot('Value');

// The label of the value: `itemToStringLabel`, else the label of the value or of its item in
// `items`, else the value. An item with the value `null` and a label wins over the placeholder.
const labels = computed<NonNullable<ItemLabel>[]>(() => {
  const items = context.data as Parameters<typeof resolveSelectedLabel>[1];
  if (!context.hasValue && props.placeholder != null && !hasNullItemLabel(items)) {
    return props.placeholder === '' ? [] : [props.placeholder];
  }
  const label = context.labelFunction;
  const resolved =
    context.mode === 'multiple'
      ? resolveMultipleLabels(context.value as unknown[], items, label)
      : [resolveSelectedLabel(context.value, items, label)];
  // An empty text would leave an empty text node.
  return resolved.filter((each) => each !== '');
});
</script>

<template>
  <slot v-if="$slots.default" :value="context.value" />
  <template v-else>
    <template v-for="(label, index) in labels" :key="index">
      <component :is="label" v-if="typeof label === 'function'" />
      <template v-else>{{ label }}</template>
    </template>
  </template>
</template>
