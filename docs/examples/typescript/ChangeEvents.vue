<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

const fruits = ['Apple', 'Banana', 'Orange'];

function onValueChange(value: string | null, eventDetails: Combobox.Root.ChangeEventDetails) {
  const reason: Combobox.Root.ChangeEventReason = eventDetails.reason;
  console.log(value, reason);
}

function onOpenChange(open: boolean, eventDetails: Combobox.Root.OpenChangeEventDetails) {
  console.log(open, eventDetails);
}
</script>

<template>
  <Combobox.Root
    :items="fruits"
    default-value="Apple"
    @value-change="onValueChange"
    @open-change="onOpenChange"
  >
    <Combobox.Input />
  </Combobox.Root>
</template>
