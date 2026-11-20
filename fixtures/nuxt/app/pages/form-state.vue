<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { DateField } from '@vase-ui/vue/date-field';
import { Select } from '@vase-ui/vue/select';
import { TimeField } from '@vase-ui/vue/time-field';

// Each part changes before the hydration, or before a move back in the history. The test reads
// the form data, the model of each part and the count of its change events.
const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
const FRUITS = ['Apple', 'Banana', 'Cherry'];

const font = ref<string | null>('serif');
const fruit = ref<string | null>(null);
const when = shallowRef<Temporal.PlainDate | null>(null);
const alarm = shallowRef<Temporal.PlainTime | null>(null);
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
      <DateField.Root v-model="when" name="when" locale="en-US" @value-change="count('when')">
        <DateField.Input data-testid="when" />
      </DateField.Root>
      <TimeField.Root
        v-model="alarm"
        name="alarm"
        locale="en-US"
        :hour-cycle="24"
        @value-change="count('alarm')"
      >
        <TimeField.Input data-testid="alarm" />
      </TimeField.Root>
    </form>

    <output data-testid="models">{{
      JSON.stringify({
        font,
        fruit,
        when: when?.toString() ?? null,
        alarm: alarm?.toString({ smallestUnit: 'minute' }) ?? null,
      })
    }}</output>
    <output data-testid="changes">{{ JSON.stringify(changes) }}</output>

    <a href="/" data-testid="away">Away</a>
  </main>
</template>
