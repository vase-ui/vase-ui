<script setup lang="ts">
import DialogRoot from './DialogRoot.vue';
</script>

<template>
  <DialogRoot v-slot="{ payload }" default-open>
    <p data-testid="payload">{{ String(payload) }}</p>
    <DialogRoot default-open :modal="false">
      <p>nested</p>
    </DialogRoot>
  </DialogRoot>
</template>
