<script lang="ts">
// A part of each family whose input Chromium restores and that takes the value of that input at
// the `pageshow` event. A new `revision` renders the part again with the same value, as a render
// before that event does.
export type FormRestoreFamily = 'combobox';
</script>

<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';

const props = defineProps<{
  family: FormRestoreFamily;
  revision: number;
}>();

const FRUITS = ['Apple', 'Banana', 'Cherry'];

const fruit = shallowRef<string | null>(null);

const MODELS = {
  combobox: fruit,
};

const model = computed(() => String(MODELS[props.family].value));
const changes = shallowRef<string[]>([]);

function record(value: unknown, details: { reason: string }) {
  changes.value = [...changes.value, `${String(value)} (${details.reason})`];
}
</script>

<template>
  <form @submit.prevent>
    <Combobox.Root
      v-if="family === 'combobox'"
      v-model="fruit"
      name="fruit"
      :items="[...FRUITS]"
      @value-change="record"
    >
      <Combobox.Input aria-label="Fruit" :data-revision="revision" />
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
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
