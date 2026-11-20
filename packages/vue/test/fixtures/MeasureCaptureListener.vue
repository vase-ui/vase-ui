<script setup lang="ts">
import type { PropType } from 'vue';

const props = defineProps({
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
  stop: { type: Boolean, default: false },
});

const outer = {
  onKeydownCapture(event: Event) {
    props.log.add('outer capture');
    if (props.stop) event.stopPropagation();
  },
  onKeydown: () => props.log.add('outer bubble'),
};
</script>

<template>
  <div v-bind="outer">
    <button id="inner" @keydown="log.add('inner')">Inner</button>
  </div>
</template>
