<script lang="ts">
export interface ComboboxCollectionState {}

export interface ComboboxCollectionProps {}
</script>

<script setup lang="ts">
import { computed } from 'vue';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import { useGroupCollectionContext } from './GroupCollectionContext';

defineProps<ComboboxCollectionProps>();

defineSlots<{ default(props: { item: any; index: number }): unknown }>();

const { filteredItems } = useComboboxDerivedItemsContext();
const groupContext = useGroupCollectionContext();

// The filter of the root gives a new list for each query. A list with the same items keeps the last
// list, so a query that keeps the same items does not render the slot of each item again.
const itemsToRender = computed<readonly any[]>((previous) => {
  const next = groupContext?.items.value ?? filteredItems.value;
  return previous !== undefined && haveSameItems(previous, next) ? previous : next;
});

function haveSameItems(previous: readonly any[], next: readonly any[]) {
  return previous.length === next.length && previous.every((item, index) => item === next[index]);
}

// The item is the key of its nodes, as the consumer of Base UI writes `key={item}`. An item then
// keeps its element when the filter moves it. A key of the index would give the element to another
// item. A `key` in the slot does not help, because the template puts the slot in a fragment.
</script>

<template>
  <template v-for="(item, index) in itemsToRender" :key="item"
    ><slot :item="item" :index="index"
  /></template>
</template>
