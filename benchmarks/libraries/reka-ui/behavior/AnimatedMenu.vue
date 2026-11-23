<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger,
} from 'reka-ui';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <DropdownMenuRoot>
      <DropdownMenuTrigger data-bench="trigger">Open</DropdownMenuTrigger>
      <DropdownMenuPortal>
        <Transition
          enter-active-class="bench-motion"
          leave-active-class="bench-motion"
          enter-from-class="bench-hidden"
          leave-to-class="bench-hidden"
        >
          <DropdownMenuContent data-bench="popup">
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
            <DropdownMenuItem>Item 3</DropdownMenuItem>
            <DropdownMenuItem>Item 4</DropdownMenuItem>
            <DropdownMenuItem>Item 5</DropdownMenuItem>
          </DropdownMenuContent>
        </Transition>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--reka-dropdown-menu-content-transform-origin);
}
</style>
