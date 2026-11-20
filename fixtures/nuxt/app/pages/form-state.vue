<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { Select } from '@vase-ui/vue/select';
import { Toolbar } from '@vase-ui/vue/toolbar';

// Each part changes before the hydration, or before a move back in the history. The test reads
// the form data, the model of each part and the count of its change events.
const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
const FRUITS = ['Apple', 'Banana', 'Cherry'];

const filter = ref('');
const font = ref<string | null>('serif');
const fruit = ref<string | null>(null);
const changes = reactive<Record<string, number>>({});

function count(name: string) {
  changes[name] = (changes[name] ?? 0) + 1;
}

function handleFilterInput(event: Event) {
  filter.value = (event.currentTarget as HTMLInputElement).value;
  count('filter');
}
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
      <Toolbar.Root>
        <Toolbar.Input
          :value="filter"
          name="filter"
          aria-label="Filter"
          data-testid="filter"
          @input="handleFilterInput"
        />
      </Toolbar.Root>

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
      <Combobox.Root v-model="fruit" name="fruit" :items="FRUITS" @value-change="count('fruit')">
        <Combobox.Input aria-label="Fruit" data-testid="fruit-input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <template #item="{ item }">
                  <Combobox.Item :value="item">{{ item }}</Combobox.Item>
                </template>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    </form>

    <output data-testid="models">{{
      JSON.stringify({
        filter,
        font,
        fruit,
      })
    }}</output>
    <output data-testid="changes">{{ JSON.stringify(changes) }}</output>

    <a href="/" data-testid="away">Away</a>
  </main>
</template>
