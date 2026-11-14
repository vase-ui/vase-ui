<script setup lang="ts">
import * as ContextMenu from '../index.parts';

withDefaults(defineProps<{ defaultOpen?: boolean; disabled?: boolean }>(), {
  defaultOpen: false,
  disabled: false,
});
</script>

<template>
  <ContextMenu.Root :default-open="defaultOpen" :disabled="disabled">
    <ContextMenu.Trigger class="area" :style="{ color: 'red' }">area</ContextMenu.Trigger>
    <ContextMenu.Trigger as="button">plain</ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Positioner>
        <ContextMenu.Popup>menu</ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
</template>
