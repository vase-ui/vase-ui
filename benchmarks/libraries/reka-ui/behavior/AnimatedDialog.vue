<script setup lang="ts">
import {
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogOverlay,
  DialogPortal,
  DialogRoot,
  DialogTitle,
  DialogTrigger,
} from 'reka-ui';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <DialogRoot>
      <DialogTrigger data-bench="trigger">Open</DialogTrigger>
      <DialogPortal>
        <DialogOverlay />
        <Transition
          enter-active-class="bench-motion"
          leave-active-class="bench-motion"
          enter-from-class="bench-hidden"
          leave-to-class="bench-hidden"
        >
          <DialogContent data-bench="popup">
            <DialogTitle>Title</DialogTitle>
            <DialogDescription>Description</DialogDescription>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Transition>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
