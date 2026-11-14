<script setup lang="ts">
import * as Tooltip from '../index.parts';

withDefaults(
  defineProps<{ defaultOpen?: boolean; defaultTriggerId?: string | null; keepMounted?: boolean }>(),
  { defaultOpen: false, defaultTriggerId: null, keepMounted: false },
);
</script>

<template>
  <Tooltip.Root
    v-slot="{ payload }"
    :default-open="defaultOpen"
    :default-trigger-id="defaultTriggerId"
  >
    <Tooltip.Trigger id="one" payload="first">One</Tooltip.Trigger>
    <Tooltip.Trigger id="two" payload="second">Two</Tooltip.Trigger>
    <span data-testid="payload">{{ payload ?? 'none' }}</span>
    <Tooltip.Portal :keep-mounted="keepMounted">
      <Tooltip.Positioner>
        <Tooltip.Popup data-testid="popup">{{ payload }}</Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
