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
import { ref } from 'vue';
import '../../../behavior/style.css';

const pageCount = ref(0);
const dialogCount = ref(0);
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="page-action" @click="pageCount++">Page action</button>
    <span data-bench="page-count">{{ pageCount }}</span>
    <DialogRoot>
      <DialogTrigger data-bench="dialog-1-trigger">Open dialog 1</DialogTrigger>
      <DialogPortal>
        <DialogOverlay class="bench-backdrop" />
        <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden">
          <DialogContent data-bench="dialog-1" class="bench-motion">
            <div class="bench-corner">
              <button type="button" data-bench="dialog-1-action" @click="dialogCount++">
                Dialog 1 action
              </button>
              <span data-bench="dialog-1-count">{{ dialogCount }}</span>
            </div>
            <DialogTitle>Dialog 1</DialogTitle>
            <DialogDescription>Description 1</DialogDescription>
            <DialogRoot>
              <DialogTrigger data-bench="dialog-2-trigger">Open dialog 2</DialogTrigger>
              <DialogPortal>
                <DialogOverlay class="bench-backdrop" />
                <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden">
                  <DialogContent data-bench="dialog-2" class="bench-motion">
                    <DialogTitle>Dialog 2</DialogTitle>
                    <DialogDescription>Description 2</DialogDescription>
                    <button type="button" data-bench="dialog-2-action">Dialog 2 action</button>
                    <DialogClose>Close</DialogClose>
                  </DialogContent>
                </Transition>
              </DialogPortal>
            </DialogRoot>
            <DialogClose>Close</DialogClose>
          </DialogContent>
        </Transition>
      </DialogPortal>
    </DialogRoot>
  </div>
</template>
