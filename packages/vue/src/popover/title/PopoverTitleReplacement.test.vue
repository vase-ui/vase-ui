<script setup lang="ts">
import * as Popover from '../index.parts';

defineProps<{ first: boolean }>();
</script>

<template>
  <Popover.Root default-open>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup>
          <Popover.Title v-if="!first">Title 2</Popover.Title>
          <Popover.Title v-if="first">Title 1</Popover.Title>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
