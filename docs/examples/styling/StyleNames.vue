<script setup lang="ts">
import { TimePicker, TimePickerItemDataAttributes } from '@vase-ui/vue/time-picker';

const rule = `.Item[${TimePickerItemDataAttributes.selected}] { font-weight: 600; }`;
</script>

<template>
  <component :is="'style'">{{ rule }}</component>
  <TimePicker.Root>
    <TimePicker.List>
      <template #item="{ time }">
        <TimePicker.Item :time="time" class="Item" />
      </template>
    </TimePicker.List>
  </TimePicker.Root>
</template>
