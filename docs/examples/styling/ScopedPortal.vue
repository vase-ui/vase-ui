<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger>Open</Popover.Trigger>
    <Popover.Portal>
      <div class="portal">
        <Popover.Positioner>
          <Popover.Popup>Content</Popover.Popup>
        </Popover.Positioner>
      </div>
    </Popover.Portal>
  </Popover.Root>
</template>

<style scoped>
.portal {
  isolation: isolate;
}
</style>
