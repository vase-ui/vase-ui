<script setup lang="ts">
import type { PropType } from 'vue';
import { PreviewCard } from '../../src/preview-card';

// With `inRoot`, the part is in a root with no portal. With `inPortal`, it is in a portal in place
// with no positioner.
defineProps({
  part: {
    type: String as PropType<'Trigger' | 'Popup' | 'Positioner' | 'Viewport'>,
    required: true,
  },
  inRoot: Boolean,
  inPortal: Boolean,
});
</script>

<template>
  <PreviewCard.Root v-if="inPortal" open>
    <PreviewCard.Portal disabled>
      <component :is="PreviewCard[part]" />
    </PreviewCard.Portal>
  </PreviewCard.Root>
  <PreviewCard.Root v-else-if="inRoot">
    <component :is="PreviewCard[part]" />
  </PreviewCard.Root>
  <component :is="PreviewCard[part]" v-else />
</template>
