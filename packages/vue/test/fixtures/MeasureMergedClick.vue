<script setup lang="ts">
import { mergeProps, type PropType } from 'vue';

const props = defineProps({
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});

const first = {
  onClick(event: Event) {
    props.log.add('first');
    event.stopImmediatePropagation();
  },
};
const second = { onClick: () => props.log.add('second') };
</script>

<template>
  <div @click="log.add('parent')">
    <button v-bind="mergeProps(first, second)">Go</button>
  </div>
</template>
