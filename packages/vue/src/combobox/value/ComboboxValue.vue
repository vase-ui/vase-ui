<script lang="ts">
import type { ItemLabel } from '../../internals/resolveValueLabel';

export interface ComboboxValueState {}

export interface ComboboxValueProps {
  /**
   * The placeholder value to display when no value is selected.
   * This is overridden by the default slot if specified, or by a null item's label in `items`.
   * It is a string, a number, or a function that returns the content of the placeholder.
   */
  placeholder?: ItemLabel;
}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { resolveMultipleLabels, resolveSelectedLabel } from '../../internals/resolveValueLabel';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

const props = defineProps<ComboboxValueProps>();

defineSlots<{
  /**
   * Formats the selected value. Treat the value as read-only: in `multiple` mode it may be a
   * shared frozen array when nothing is selected.
   */
  default?(props: { value: any }): unknown;
}>();

const store = useComboboxRootContext();

const value = computed(() => store.select('selectedValue'));

const labels = computed<NonNullable<ItemLabel>[]>(() => {
  if (
    !store.select('hasSelectedValue') &&
    props.placeholder != null &&
    !store.select('hasNullItemLabel', true)
  ) {
    return props.placeholder === '' ? [] : [props.placeholder];
  }

  const items = store.select('items');
  const itemToStringLabel = store.select('itemToStringLabel');
  const resolved =
    store.select('selectionMode') === 'multiple' && Array.isArray(value.value)
      ? resolveMultipleLabels(value.value, items, itemToStringLabel)
      : [resolveSelectedLabel(value.value, items, itemToStringLabel)];
  // An empty text would leave an empty text node.
  return resolved.filter((label) => label !== '');
});
</script>

<template>
  <slot v-if="$slots.default" :value="value" />
  <template v-else-if="labels.length > 0">
    <template v-for="(label, index) in labels" :key="index">
      <component :is="label" v-if="typeof label === 'function'" />
      <template v-else>{{ label }}</template>
    </template>
  </template>
</template>
