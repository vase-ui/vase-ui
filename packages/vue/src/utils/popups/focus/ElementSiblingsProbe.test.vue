<script setup lang="ts">
import { computed, onMounted, shallowRef } from 'vue';
import { useElementSiblings } from './useElementSiblings';

const props = withDefaults(
  defineProps<{ placed?: boolean; as?: string; rendered?: boolean; after?: string[] }>(),
  {
    placed: true,
    as: 'button',
    rendered: true,
    after: () => ['after-1', 'after-2'],
  },
);

const element = shallowRef<HTMLElement | null>(null);
const isMounted = shallowRef(false);
const nodes = new Map<string, HTMLSpanElement>();

function getNode(name: string) {
  let node = nodes.get(name);
  if (!node) {
    node = document.createElement('span');
    node.setAttribute('data-testid', name);
    nodes.set(name, node);
  }
  return node;
}

// A server calls no mount hook, so a server render makes no node.
onMounted(() => {
  isMounted.value = true;
});

useElementSiblings(
  element,
  computed(() =>
    props.placed && isMounted.value
      ? { before: ['before-1', 'before-2'].map(getNode), after: props.after.map(getNode) }
      : null,
  ),
);
</script>

<template>
  <component :is="as" v-if="rendered" ref="element" data-testid="element">element</component>
</template>
