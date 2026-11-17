<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
</script>

<template>
  <main>
    <button type="button" data-testid="before">Before</button>
    <Dialog.Root default-open :modal="false" disable-pointer-dismissal>
      <Dialog.Portal disabled>
        <Dialog.Backdrop />
        <Dialog.Popup :initial-focus="false" data-testid="panel">
          <Dialog.Title data-testid="panel-title">Panel title</Dialog.Title>
          <Dialog.Close data-testid="panel-close">Close</Dialog.Close>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
    <button type="button" data-testid="after">After</button>
  </main>
</template>
