<script setup lang="ts">
import { reactive, shallowRef } from 'vue';
import { DateField } from '@vase-ui/vue/date-field';

const when = shallowRef<Temporal.PlainDate | null>(null);
// For each part, the value and the type of the event of each change.
const changes = reactive<Record<string, string[]>>({});

function record(name: string, value: unknown, details: { event: Event }) {
  (changes[name] ??= []).push(`${String(value)} (${details.event.type})`);
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <DateField.Root
      v-model="when"
      name="when"
      locale="en-US"
      @value-change="(value, details) => record('when', value, details)"
    >
      <DateField.Input data-testid="when" />
    </DateField.Root>
  </form>
  <output data-testid="models">{{ JSON.stringify({ when: when?.toString() ?? null }) }}</output>
  <output data-testid="changes">{{ JSON.stringify(changes) }}</output>
  <a href="./away.html" data-testid="away">Away</a>
</template>
