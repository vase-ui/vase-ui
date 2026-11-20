<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Slider } from '@vase-ui/vue/slider';

const range = ref([20, 80]);
// For each part, the value and the type of the event of each change.
const changes = reactive<Record<string, string[]>>({});

function record(name: string, value: unknown, details: { event: Event }) {
  (changes[name] ??= []).push(`${String(value)} (${details.event.type})`);
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <Slider.Root
      v-model="range"
      name="range"
      @value-change="(value, details) => record('range', value, details)"
    >
      <Slider.Control style="position: relative; width: 200px; height: 10px">
        <Slider.Thumb aria-label="Minimum" style="width: 20px; height: 10px" />
        <Slider.Thumb aria-label="Maximum" style="width: 20px; height: 10px" />
      </Slider.Control>
    </Slider.Root>
  </form>
  <output data-testid="models">{{ JSON.stringify({ range }) }}</output>
  <output data-testid="changes">{{ JSON.stringify(changes) }}</output>
  <a href="./away.html" data-testid="away">Away</a>
</template>
