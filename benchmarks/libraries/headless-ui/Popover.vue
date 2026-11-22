<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
</script>

<template>
  <Popover>
    <PopoverButton data-bench="trigger">Open</PopoverButton>
    <PopoverPanel data-bench="popup">
      <h2>Title</h2>
      <p>Description</p>
    </PopoverPanel>
  </Popover>
</template>
