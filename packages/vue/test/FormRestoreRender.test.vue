<script lang="ts">
// A part of each family whose input Chromium restores and that takes the value of that input at
// the `pageshow` event. A new `revision` renders the part again with the same value, as a render
// before that event does.
export type FormRestoreFamily = 'select';
</script>

<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Select } from '@vase-ui/vue/select';

const props = defineProps<{
  family: FormRestoreFamily;
  revision: number;
}>();

const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };

const font = shallowRef<string | null>('serif');

const MODELS = {
  select: font,
};

const model = computed(() => String(MODELS[props.family].value));
const changes = shallowRef<string[]>([]);

function record(value: unknown, details: { reason: string }) {
  changes.value = [...changes.value, `${String(value)} (${details.reason})`];
}
</script>

<template>
  <form @submit.prevent>
    <Select.Root
      v-if="family === 'select'"
      v-model="font"
      name="font"
      :items="{ ...FONTS }"
      @value-change="record"
    >
      <Select.Trigger :data-revision="revision"><Select.Value /></Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item v-for="(label, key) in FONTS" :key="key" :value="key">
              <Select.ItemText>{{ label }}</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </form>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
