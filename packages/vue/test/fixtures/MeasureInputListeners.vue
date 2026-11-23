<script setup lang="ts">
import { nextTick, shallowRef, watch, type PropType } from 'vue';

// A native input with `:value`. Its `input` listener first reads the text of the input after
// `nextTick` and after a `flush: 'post'` watcher, as a part can. Then it writes the text in upper
// case, as a listener of a page after the one of a part can.
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
