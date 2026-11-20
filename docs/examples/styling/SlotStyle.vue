<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';
</script>

<template>
  <TimePicker.Root>
    <TimePicker.List aria-label="Times">
      <template #item="{ time }">
        <TimePicker.Item :time="time">
          <template #element="{ props, elementRef, state, text }">
            <button
              v-bind="props"
              :ref="elementRef"
              :style="{ color: state.selected ? 'red' : 'blue' }"
            >
              {{ text }}
            </button>
          </template>
        </TimePicker.Item>
      </template>
    </TimePicker.List>
  </TimePicker.Root>
</template>
