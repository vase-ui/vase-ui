<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Select } from '@vase-ui/vue/select';

// Each part changes before the hydration, or before a move back in the history. The test reads
// the form data, the model of each part and the count of its change events.
const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };

const font = ref<string | null>('serif');
const changes = reactive<Record<string, number>>({});

function count(name: string) {
  changes[name] = (changes[name] ?? 0) + 1;
}
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
      <Select.Root v-model="font" name="font" :items="FONTS" @value-change="count('font')">
        <Select.Trigger data-testid="font-trigger"><Select.Value /></Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item v-for="(label, value) in FONTS" :key="value" :value="value">
                <Select.ItemText>{{ label }}</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    </form>

    <output data-testid="models">{{
      JSON.stringify({
        font,
      })
    }}</output>
    <output data-testid="changes">{{ JSON.stringify(changes) }}</output>

    <a href="/" data-testid="away">Away</a>
  </main>
</template>
