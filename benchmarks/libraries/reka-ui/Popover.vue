<script setup lang="ts">
import { PopoverArrow, PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from 'reka-ui';
</script>

<template>
  <PopoverRoot>
    <PopoverTrigger data-bench="trigger">Open</PopoverTrigger>
    <PopoverPortal>
      <PopoverContent data-bench="popup">
        <h2>Title</h2>
        <p>Description</p>
        <PopoverArrow />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
