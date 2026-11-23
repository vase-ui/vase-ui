<script setup lang="ts">
import { nextTick, shallowRef, watch, type PropType } from 'vue';

const props = defineProps({
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
const text = shallowRef('');
const requests = shallowRef(0);
let input: HTMLInputElement | undefined;
watch(requests, () => props.log.add(`post watcher: ${input?.value}`), { flush: 'post' });

function onInput(event: Event) {
  input = event.target as HTMLInputElement;
  void nextTick(() => props.log.add(`nextTick: ${input?.value}`));
  requests.value += 1;
  text.value = input.value.toUpperCase();
}
</script>

<template>
  <input :value="text" aria-label="Text" @input="onInput" />
</template>
