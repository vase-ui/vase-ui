<script setup lang="ts">
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <PopoverRoot>
      <PopoverTrigger data-bench="trigger">Open</PopoverTrigger>
      <PopoverPortal>
        <Transition
          enter-active-class="bench-motion"
          leave-active-class="bench-motion"
          enter-from-class="bench-hidden"
          leave-to-class="bench-hidden"
        >
          <PopoverContent data-bench="popup">
            <h2>Title</h2>
            <p>Description</p>
            <PopoverArrow />
          </PopoverContent>
        </Transition>
      </PopoverPortal>
    </PopoverRoot>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--reka-popover-content-transform-origin);
}
</style>
