<script setup lang="ts">
import { shallowRef } from 'vue';
import { Select } from '@vase-ui/vue/select';
import type { SelectRootChangeEventDetails } from '@vase-ui/vue/select';

const props = defineProps<{
  // With no name, the hidden input is `type="hidden"`.
  name?: string | undefined;
  // The first value of `v-model:value`.
  value?: string | undefined;
}>();

const fonts = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
const model = shallowRef<string | null>(props.value ?? null);
const changes = shallowRef<string[]>([]);

function handleValueChange(value: string | null, details: SelectRootChangeEventDetails) {
  changes.value = [...changes.value, `${String(value)} (${details.reason})`];
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <Select.Root
      v-model:value="model"
      :name="name"
      :items="fonts"
      @value-change="handleValueChange"
    >
      <Select.Trigger data-testid="trigger">
        <Select.Value data-testid="value" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item v-for="(label, key) in fonts" :key="key" :value="key">
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
