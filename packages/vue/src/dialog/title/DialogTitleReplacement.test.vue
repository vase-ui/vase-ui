<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

defineProps<{ first: boolean }>();
</script>

<template>
  <Dialog.Root default-open :modal="false">
    <Dialog.Portal>
      <Dialog.Popup>
        <Dialog.Title v-if="!first">Title 2</Dialog.Title>
        <Dialog.Title v-if="first">Title 1</Dialog.Title>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>
