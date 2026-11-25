<script setup lang="ts">
import { useId } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { options } from '../../../harness/options.ts';
import '../../../behavior/style.css';

const id = useId();
</script>

<template>
  <div class="bench-page">
    <Combobox.Root :items="options">
      <label :for="id">Label</label>
      <Combobox.InputGroup data-bench="anchor">
        <Combobox.Input :id="id" data-bench="input" />
        <Combobox.Clear>Clear</Combobox.Clear>
        <Combobox.Trigger data-bench="trigger">Open</Combobox.Trigger>
      </Combobox.InputGroup>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden" appear>
            <Combobox.Popup data-bench="popup" class="bench-motion">
              <Combobox.Empty>No results</Combobox.Empty>
              <Combobox.List>
                <template #item="{ item }">
                  <Combobox.Item :value="item">{{ item }}</Combobox.Item>
                </template>
              </Combobox.List>
            </Combobox.Popup>
          </Transition>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}
</style>
