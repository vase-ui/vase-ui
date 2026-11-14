<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';

// The page makes the handle in `setup`, so a request does not share it with another request.
const handle = Menu.createHandle<string>();
</script>

<template>
  <main>
    <Menu.Root>
      <Menu.Trigger data-testid="closed">Closed</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid="closed-popup">Closed popup</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <Menu.Root default-open default-trigger-id="open-trigger">
      <Menu.Trigger id="open-trigger" data-testid="open">Open</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid="open-popup">Open popup</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
    <Menu.Trigger id="detached-trigger" :handle="handle" data-testid="detached">
      Detached
    </Menu.Trigger>
    <Menu.Root :handle="handle">
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup data-testid="detached-popup">Detached popup</Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </main>
</template>
