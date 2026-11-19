<script setup lang="ts">
import { mergeProps, type PropType } from 'vue';

const props = defineProps({ log: { type: Array as PropType<string[]>, required: true } });

const first = {
  onClick(event: Event) {
    props.log.push('first');
    event.stopImmediatePropagation();
  },
};
const second = { onClick: () => props.log.push('second') };
</script>

<template>
  <div @click="log.push('parent')">
    <button v-bind="mergeProps(first, second)">Go</button>
  </div>
</template>
