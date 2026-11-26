<script setup lang="ts">
import { onMounted, useTemplateRef, type PropType } from 'vue';

const props = defineProps({
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
const input = useTemplateRef<HTMLInputElement>('input');
onMounted(() => {
  const element = input.value;
  if (!element) return;
  element.focus();
  const shown = element.closest('.popup')?.checkVisibility() ? 'shown' : 'hidden';
  const focused = document.activeElement === element ? 'focused' : 'not focused';
  props.log.add(`mounted, popup ${shown}, ${focused}`);
});
</script>

<template>
  <div style="height: 40px"><input ref="input" aria-label="Field" /></div>
</template>
