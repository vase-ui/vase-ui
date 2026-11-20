<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';
import SlotHost from './SlotHost.test.vue';
</script>

<template>
  <SlotHost>
    <TimePicker.Root :open="false">content</TimePicker.Root>
  </SlotHost>
</template>
