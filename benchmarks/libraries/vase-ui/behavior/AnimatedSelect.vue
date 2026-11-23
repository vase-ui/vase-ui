<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';
import { options } from '../../../harness/options.ts';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Select.Root default-value="Option 1">
      <Select.Label>Label</Select.Label>
      <Select.Trigger data-bench="trigger">
        <Select.Value />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden">
            <Select.Popup data-bench="popup" class="bench-motion">
              <Select.List>
                <Select.Item v-for="option in options" :key="option" :value="option">
                  <Select.ItemText>{{ option }}</Select.ItemText>
                </Select.Item>
              </Select.List>
            </Select.Popup>
          </Transition>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}
</style>
