<script setup lang="ts">
import type { PropType } from 'vue';
import { Dialog } from '../../src/dialog';

// With `inRoot`, the part is in a root with no portal.
defineProps({
  part: {
    type: String as PropType<'Trigger' | 'Backdrop' | 'Viewport' | 'Popup'>,
    required: true,
  },
  inRoot: Boolean,
});
</script>

<template>
  <Dialog.Root v-if="inRoot">
    <component :is="Dialog[part]" />
  </Dialog.Root>
  <component :is="Dialog[part]" v-else />
</template>
