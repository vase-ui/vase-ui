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
</script>

<template>
  <DialogRoot>
    <DialogTrigger data-bench="trigger">Open</DialogTrigger>
    <DialogPortal>
      <DialogOverlay />
      <DialogContent data-bench="popup">
        <DialogTitle>Title</DialogTitle>
        <DialogDescription>Description</DialogDescription>
        <DialogClose>Close</DialogClose>
      </DialogContent>
    </DialogPortal>
  </DialogRoot>
</template>
