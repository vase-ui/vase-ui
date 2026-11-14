<script setup lang="ts">
import * as Dialog from '../index.parts';

withDefaults(defineProps<{ defaultOpen?: boolean; defaultTriggerId?: string | null }>(), {
  defaultOpen: false,
  defaultTriggerId: null,
});
</script>

<template>
  <Dialog.Root :default-open="defaultOpen" :default-trigger-id="defaultTriggerId" :modal="false">
    <Dialog.Trigger id="one">One</Dialog.Trigger>
    <Dialog.Trigger id="two">Two</Dialog.Trigger>
  </Dialog.Root>
</template>
