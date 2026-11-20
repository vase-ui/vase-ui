<script setup lang="ts">
import { inject, onScopeDispose, shallowRef } from 'vue';

// A link that is in the list of its parent from its `setup` to the end of its scope.
const props = defineProps({ id: { type: String, required: true } });
const links = inject<{ readonly id: string; readonly element: Element | null }[]>('links')!;
const element = shallowRef<Element | null>(null);
const entry = {
  id: props.id,
  get element() {
    return element.value;
  },
};
links.push(entry);
onScopeDispose(() => links.splice(links.indexOf(entry), 1));

function setElement(value: unknown) {
  element.value = value as Element | null;
}
</script>

<template>
  <a :id :ref="setElement" href="#first">First</a>
</template>
