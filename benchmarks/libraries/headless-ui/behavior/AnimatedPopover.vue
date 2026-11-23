<script setup lang="ts">
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/vue';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Popover>
      <PopoverButton data-bench="trigger">Open</PopoverButton>
      <Transition
        enter-active-class="bench-motion"
        leave-active-class="bench-motion"
        enter-from-class="bench-hidden"
        leave-to-class="bench-hidden"
      >
        <PopoverPanel data-bench="popup">
          <h2>Title</h2>
          <p>Description</p>
        </PopoverPanel>
      </Transition>
    </Popover>
  </div>
</template>
