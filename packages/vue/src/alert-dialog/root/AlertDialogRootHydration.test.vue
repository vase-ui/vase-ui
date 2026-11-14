<script setup lang="ts">
import DialogRoot from '../../dialog/root/DialogRoot.vue';
import AlertDialogRoot from './AlertDialogRoot.vue';
</script>

<template>
  <DialogRoot default-open>
    <AlertDialogRoot v-slot="{ payload }" default-open>
      <p data-testid="payload">{{ String(payload) }}</p>
    </AlertDialogRoot>
  </DialogRoot>
</template>
