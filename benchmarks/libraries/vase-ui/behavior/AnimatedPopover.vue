<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Popover.Root>
      <Popover.Trigger data-bench="trigger">Open</Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner>
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden" appear>
            <Popover.Popup data-bench="popup" class="bench-motion">
              <Popover.Arrow />
              <Popover.Title>Title</Popover.Title>
              <Popover.Description>Description</Popover.Description>
            </Popover.Popup>
          </Transition>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}
</style>
