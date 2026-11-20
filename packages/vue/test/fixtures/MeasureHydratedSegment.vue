<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';

const props = defineProps<{
  attrs: Record<string, string>;
  value: string;
  allow: boolean;
  write: boolean;
}>();

const input = shallowRef<HTMLInputElement | null>(null);
function setInput(element: unknown) {
  input.value = element as HTMLInputElement | null;
}

onMounted(() => {
  if (!props.write || !input.value) return;
  for (const [name, value] of Object.entries(props.attrs)) input.value.setAttribute(name, value);
});
</script>

<template>
  <input
    :ref="setInput"
    type="text"
    v-bind="attrs"
    :value="value"
    :data-allow-mismatch="allow ? 'attribute' : undefined"
  />
</template>
