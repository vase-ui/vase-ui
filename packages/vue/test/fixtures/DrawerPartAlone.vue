<script setup lang="ts">
import { Drawer } from '../../src/drawer';

// One part of a drawer with a part that it needs left out: `noViewport` leaves the viewport out of a
// popup, `noPortal` leaves the portal out of a viewport, and `noRoot` leaves the root out.
defineProps({ noViewport: Boolean, noPortal: Boolean, noRoot: Boolean });
</script>

<template>
  <Drawer.Viewport v-if="noRoot" />
  <Drawer.Root v-else default-open>
    <Drawer.Viewport v-if="noPortal" />
    <Drawer.Portal v-else-if="noViewport" disabled>
      <Drawer.Popup />
    </Drawer.Portal>
  </Drawer.Root>
</template>
