<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

function keepPopupOpen(open: boolean, eventDetails: Combobox.Root.OpenChangeEventDetails) {
  if (!open && eventDetails.reason === 'item-press') {
    eventDetails.cancel();
  }
}
</script>

<template>
  <Combobox.Root multiple @open-change="keepPopupOpen">
    <!-- ... -->
  </Combobox.Root>
</template>
