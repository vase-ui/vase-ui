<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';
</script>

<template>
  <Combobox.Root>
    <Combobox.Input />
    <Combobox.Trigger data-testid="trigger" />
  </Combobox.Root>
</template>
