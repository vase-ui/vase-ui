<script setup lang="ts">
import { ContextMenu } from '@vase-ui/vue/context-menu';
</script>

<template>
  <main>
    <ContextMenu.Root>
      <ContextMenu.Trigger data-testid="closed">Closed</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup data-testid="closed-popup">
            <ContextMenu.Item>Copy</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
    <ContextMenu.Root default-open>
      <ContextMenu.Trigger data-testid="open">Open</ContextMenu.Trigger>
      <ContextMenu.Portal>
        <ContextMenu.Positioner>
          <ContextMenu.Popup data-testid="open-popup">
            <ContextMenu.Item>Paste</ContextMenu.Item>
          </ContextMenu.Popup>
        </ContextMenu.Positioner>
      </ContextMenu.Portal>
    </ContextMenu.Root>
  </main>
</template>
