<script setup lang="ts">
import type { PropType } from 'vue';
import { AlertDialog } from '../../src/alert-dialog';
import { Dialog } from '../../src/dialog';

// With `inRoot`, the part is in a root with no portal. With `alert`, the part is of Alert Dialog.
defineProps({
  part: {
    type: String as PropType<'Trigger' | 'Backdrop' | 'Viewport' | 'Popup'>,
    required: true,
  },
  inRoot: Boolean,
  alert: Boolean,
});
</script>

<template>
  <Dialog.Root v-if="inRoot">
    <component :is="Dialog[part]" />
  </Dialog.Root>
  <component :is="(alert ? AlertDialog : Dialog)[part]" v-else />
</template>
