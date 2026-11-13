<script setup lang="ts">
import * as Tooltip from '../index.parts';

withDefaults(defineProps<{ defaultOpen?: boolean; defaultTriggerId?: string | null }>(), {
  defaultOpen: false,
  defaultTriggerId: null,
});
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
  </Tooltip.Root>
</template>
