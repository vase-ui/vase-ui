<script setup lang="ts">
import { defineComponent } from 'vue';
import type { PropType } from 'vue';
import { useServerElement } from './hydration';

defineProps<{ onRead?: ((element: HTMLElement | null) => void) | undefined }>();

// A part that renders only a comment, before the element of another part.
const PartWithNoElement = defineComponent({
  props: { onRead: { type: Function as PropType<(element: HTMLElement | null) => void> } },
  setup(partProps) {
    partProps.onRead?.(useServerElement()());
    return () => null;
  },
});
</script>

<template>
  <PartWithNoElement :on-read="onRead" />
  <div data-testid="next-part" />
</template>
