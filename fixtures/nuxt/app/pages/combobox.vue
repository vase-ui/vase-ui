<script setup lang="ts">
import { Combobox } from '@vase-ui/vue/combobox';

const FRUITS = ['Apple', 'Banana', 'Cherry'];
const TAGS = ['a', 'b', 'c'];
const COUNTRIES = ['Norway', 'Sweden'];
</script>

<template>
  <main>
    <form data-testid="form">
      <Combobox.Root name="fruit" default-value="Banana" :items="FRUITS">
        <Combobox.Input data-testid="fruit-input" aria-label="Fruit" />
        <Combobox.Trigger data-testid="fruit-trigger" aria-label="Open popup" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="fruit-popup">
              <Combobox.List>
                <template #item="{ item }">
                  <Combobox.Item :value="item">{{ item }}</Combobox.Item>
                </template>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>

      <Combobox.Root name="tags" multiple :default-value="['b']" :items="TAGS">
        <Combobox.Value v-slot="{ value }">
          <Combobox.Chips data-testid="tags-chips">
            <Combobox.Chip v-for="tag in value" :key="tag" data-testid="tags-chip">
              {{ tag }}
              <Combobox.ChipRemove :aria-label="`Remove ${tag}`" />
            </Combobox.Chip>
            <Combobox.Input data-testid="tags-input" aria-label="Tags" />
          </Combobox.Chips>
        </Combobox.Value>
      </Combobox.Root>

      <Combobox.Root name="country" default-value="Sweden" :items="COUNTRIES">
        <Combobox.Trigger data-testid="country-trigger">
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Label data-testid="country-label">Country</Combobox.Label>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup data-testid="country-popup">
              <Combobox.Input data-testid="country-input" aria-label="Search countries" />
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
  </main>
</template>
