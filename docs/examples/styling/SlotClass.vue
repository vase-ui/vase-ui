<script setup lang="ts">
import { TimePicker } from '@vase-ui/vue/time-picker';
</script>

<template>
  <TimePicker.Root>
    <TimePicker.List>
      <template #item="{ time }">
        <TimePicker.Item :time="time">
          <template #render="{ props, state, text }">
            <div v-bind="props" :ref="props.ref" :class="state.selected ? 'selected' : 'idle'">
              {{ text }}
            </div>
          </template>
        </TimePicker.Item>
      </template>
    </TimePicker.List>
  </TimePicker.Root>
</template>
