<script setup lang="ts">
import { Drawer } from '../../src/drawer';
</script>

<template>
  <Drawer.Root default-open>
    <Drawer.VirtualKeyboardProvider>
      <Drawer.Portal>
        <Drawer.Viewport data-testid="viewport">
          <Drawer.Popup data-testid="popup">
            <input data-testid="field" aria-label="Field" />
          </Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.VirtualKeyboardProvider>
  </Drawer.Root>
</template>
