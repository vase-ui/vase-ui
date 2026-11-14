<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Backdrop data-testid="backdrop" />
    <Dialog.Root default-open>
      <Dialog.Backdrop data-testid="nested-backdrop" />
    </Dialog.Root>
  </Dialog.Root>
</template>
