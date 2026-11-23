<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <TooltipProvider>
      <TooltipRoot :delay-duration="0">
        <TooltipTrigger data-bench="trigger">Open</TooltipTrigger>
        <TooltipPortal>
          <Transition
            enter-active-class="bench-motion"
            leave-active-class="bench-motion"
            enter-from-class="bench-hidden"
            leave-to-class="bench-hidden"
          >
            <TooltipContent data-bench="popup">
              Tooltip
              <TooltipArrow />
            </TooltipContent>
          </Transition>
        </TooltipPortal>
      </TooltipRoot>
    </TooltipProvider>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--reka-tooltip-content-transform-origin);
}
</style>
