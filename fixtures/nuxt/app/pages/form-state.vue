<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';

// Each part changes before the hydration, or before a move back in the history. The test reads
// the form data, the model of each part and the count of its change events.
const FRUITS = ['Apple', 'Banana', 'Cherry'];

const fruit = ref<string | null>(null);
const changes = reactive<Record<string, number>>({});

function count(name: string) {
  changes[name] = (changes[name] ?? 0) + 1;
}
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent>
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
        fruit,
      })
    }}</output>
    <output data-testid="changes">{{ JSON.stringify(changes) }}</output>

    <a href="/" data-testid="away">Away</a>
  </main>
</template>
