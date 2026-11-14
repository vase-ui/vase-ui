<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

function keepFilter(_inputValue: string, eventDetails: Combobox.Root.ChangeEventDetails) {
  if (eventDetails.isItemPress) {
    eventDetails.cancel();
  }
}
</script>

<template>
  <Combobox.Root multiple @input-value-change="keepFilter">
    <!-- ... -->
  </Combobox.Root>
</template>
