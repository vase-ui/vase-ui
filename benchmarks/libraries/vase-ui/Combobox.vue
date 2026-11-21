<script setup lang="ts">
import { useId } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { options } from '../../harness/options.ts';

const id = useId();
</script>

<template>
  <Combobox.Root :items="options">
    <label :for="id">Label</label>
    <Combobox.InputGroup>
      <Combobox.Input :id="id" data-bench="input" />
      <Combobox.Clear>Clear</Combobox.Clear>
      <Combobox.Trigger data-bench="trigger">Open</Combobox.Trigger>
    </Combobox.InputGroup>
    <Combobox.Portal>
      <Combobox.Positioner>
        <Combobox.Popup data-bench="popup">
          <Combobox.Empty>No results</Combobox.Empty>
          <Combobox.List>
            <template #item="{ item }">
              <Combobox.Item :value="item">{{ item }}</Combobox.Item>
            </template>
          </Combobox.List>
        </Combobox.Popup>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
