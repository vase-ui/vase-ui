<script setup lang="ts">
import * as Drawer from '../index.parts';

defineProps<{ first: boolean }>();
</script>

<template>
  <div>
    <button>outside</button>
    <Drawer.Root default-open>
      <Drawer.Backdrop v-if="!first" data-testid="second" />
      <Drawer.Backdrop v-if="first" data-testid="first" />
      <Drawer.Portal>
        <Drawer.Viewport>
          <Drawer.Popup>Drawer</Drawer.Popup>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.Root>
  </div>
</template>
