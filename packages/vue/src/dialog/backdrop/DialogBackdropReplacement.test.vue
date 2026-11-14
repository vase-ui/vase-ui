<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

defineProps<{ first: boolean }>();
</script>

<template>
  <div>
    <button>outside</button>
    <Dialog.Root default-open>
      <Dialog.Backdrop v-if="!first" data-testid="second" />
      <Dialog.Backdrop v-if="first" data-testid="first" />
      <Dialog.Portal><Dialog.Popup /></Dialog.Portal>
    </Dialog.Root>
  </div>
</template>
