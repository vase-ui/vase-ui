<script setup lang="ts">
import {
  TooltipArrow,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipRoot,
  TooltipTrigger,
} from 'reka-ui';
</script>

<template>
  <TooltipProvider>
    <TooltipRoot>
      <TooltipTrigger data-bench="trigger">Open</TooltipTrigger>
      <TooltipPortal>
        <TooltipContent data-bench="popup">
          Tooltip
          <TooltipArrow />
        </TooltipContent>
      </TooltipPortal>
    </TooltipRoot>
  </TooltipProvider>
</template>
