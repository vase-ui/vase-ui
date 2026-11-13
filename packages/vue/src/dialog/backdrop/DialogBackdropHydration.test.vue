<script setup lang="ts">
import * as Dialog from '../index.parts';
</script>

<template>
  <Dialog.Root default-open>
    <Dialog.Backdrop data-testid="backdrop" />
    <Dialog.Root default-open>
      <Dialog.Backdrop data-testid="nested-backdrop" />
    </Dialog.Root>
  </Dialog.Root>
</template>
