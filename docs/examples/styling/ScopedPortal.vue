<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
</script>

<template>
  <Popover.Root>
    <Popover.Trigger>Open</Popover.Trigger>
    <Popover.Portal>
      <template #render="{ props, children }">
        <div v-bind="props" class="portal">
          <component :is="children">
            <Popover.Positioner>
              <Popover.Popup>Content</Popover.Popup>
            </Popover.Positioner>
          </component>
        </div>
      </template>
    </Popover.Portal>
  </Popover.Root>
</template>

<style scoped>
.portal {
  isolation: isolate;
}
</style>
