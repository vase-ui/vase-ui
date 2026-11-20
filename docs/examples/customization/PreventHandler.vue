<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';
</script>

<template>
  <TimePicker.Root>
    <TimePicker.List>
      <template #item="{ time }">
        <TimePicker.Item :time="time" @keydown="(event) => event.preventVaseUIHandler()" />
      </template>
    </TimePicker.List>
  </TimePicker.Root>
</template>
