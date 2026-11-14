<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { useElementSiblings } from './useElementSiblings';
import type { ElementSiblings } from './useElementSiblings';

const props = withDefaults(defineProps<{ placed?: boolean; as?: string; rendered?: boolean }>(), {
  placed: true,
  as: 'button',
  rendered: true,
});

const element = shallowRef<HTMLElement | null>(null);
const nodes = shallowRef<ElementSiblings | null>(null);

function createNode(name: string) {
  const node = document.createElement('span');
  node.setAttribute('data-testid', name);
  return node;
}

// A server calls no mount hook, so a server render makes no node.
onMounted(() => {
  nodes.value = {
    before: [createNode('before-1'), createNode('before-2')],
    after: [createNode('after-1'), createNode('after-2')],
  };
});

useElementSiblings(
  element,
  computed(() => (props.placed ? nodes.value : null)),
);
</script>

<template>
  <component :is="as" v-if="rendered" ref="element" data-testid="element">element</component>
</template>
