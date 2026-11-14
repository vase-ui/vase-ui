<script lang="ts">
export interface ComboboxCollectionState {}

export interface ComboboxCollectionProps {}
</script>

<script setup lang="ts">
import { cloneVNode, computed, Fragment, renderSlot } from 'vue';
import type { FunctionalComponent, Slots, VNode } from 'vue';
import { useComboboxDerivedItemsContext } from '../root/ComboboxRootContext';
import { useGroupCollectionContext } from './GroupCollectionContext';

defineProps<ComboboxCollectionProps>();

const slots = defineSlots<{ default(props: { item: any; index: number }): unknown }>();

const { filteredItems } = useComboboxDerivedItemsContext();
const groupContext = useGroupCollectionContext();

// The filter of the root gives a new list for each query. A list with the same items keeps the last
// list, so a query that keeps the same items renders the items again only where Vue must.
const itemsToRender = computed<readonly any[]>((previous) => {
  const next = groupContext?.items.value ?? filteredItems.value;
  return previous !== undefined && haveSameItems(previous, next) ? previous : next;
});

function haveSameItems(previous: readonly any[], next: readonly any[]) {
  return previous.length === next.length && previous.every((item, index) => item === next[index]);
}

// The key that the consumer gives the content of one item. A slot that a part forwards wraps the
// content in one more fragment.
function getContentKey(fragment: VNode) {
  let node = fragment;
  while (node.type === Fragment && Array.isArray(node.children) && node.children.length === 1) {
    node = node.children[0] as VNode;
  }
  return node === fragment ? undefined : (node.key ?? undefined);
}

// React keys the nodes of each item with the key of the consumer, so a filter moves an item and
// does not mount it again. The fragment of each item takes that key for the same result. A
// fragment of `renderSlot` patches its content as a compiled template does, so an item with the
// same props does not render again.
const ItemNodes: FunctionalComponent = () =>
  itemsToRender.value.map((item, index) => {
    const fragment = renderSlot(slots as Slots, 'default', { item, index });
    return cloneVNode(fragment, { key: getContentKey(fragment) });
  });
</script>

<template>
  <ItemNodes />
</template>
