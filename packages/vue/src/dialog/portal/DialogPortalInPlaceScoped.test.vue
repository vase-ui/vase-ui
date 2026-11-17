<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';

defineProps<{ visible: boolean }>();
</script>

<template>
  <Dialog.Root default-open :modal="false" disable-pointer-dismissal>
    <Dialog.Portal v-show="visible" disabled class="portal" data-testid="portal">
      <Dialog.Popup :initial-focus="false">Panel</Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
</template>

<style scoped>
.portal {
  outline-style: dashed;
}
</style>
