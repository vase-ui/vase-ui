<script setup lang="ts">
import { Button, createNotificationsContext, Snackbar } from '@vuetify/v0';
import { onScopeDispose, toRef } from 'vue';
import { toastTimeout } from '../../../harness/toastTimeout.ts';
import '../../../behavior/style.css';
import '../../../behavior/toasts.css';

const namespace = 'bench:toasts';
const [, provide, notifications] = createNotificationsContext({ namespace });

provide();

onScopeDispose(() => {
  notifications.dispose();
  notifications.queue.dispose();
});

// The docs give the prop `urgent` of `Snackbar.Root` to a toast that a screen reader announces at
// once, and the field `severity` of a notification for its urgency.
function addToast(important = false) {
  notifications.send({
    subject: 'Saved',
    body: 'The file is saved.',
    ...(important ? { severity: 'error' } : {}),
    timeout: toastTimeout,
  });
}

// The stack of the example "Stacked toasts" of the docs, with the sizes of the fixture. The docs
// expand the stack while the pointer is on it, through pointer listeners of the fixture, so this
// stack stays collapsed.
const ITEM_HEIGHT = 74;
const PEEK = 16;
const MAX_STACK = 3;

const height = toRef(() => {
  const count = Math.min(notifications.queue.values().length, MAX_STACK);
  return count === 0 ? 0 : ITEM_HEIGHT + (count - 1) * PEEK;
});

function style(index: number) {
  const depth = Math.min(index, MAX_STACK - 1);
  return {
    bottom: 0,
    left: `${String(depth * 8)}px`,
    right: `${String(depth * 8)}px`,
    transform: `translateY(${String(-depth * PEEK)}px) scale(${String(1 - depth * 0.04)})`,
    transformOrigin: 'bottom center',
    opacity: index >= MAX_STACK ? 0 : Math.max(0, 1 - index * 0.2),
    zIndex: index >= MAX_STACK ? -1 : MAX_STACK - index,
    pointerEvents: index === 0 ? ('auto' as const) : ('none' as const),
  };
}
</script>

<template>
  <div class="bench-page">
    <button type="button" data-bench="add-toast" @click="addToast()">Add toast</button>
    <button type="button" data-bench="add-important-toast" @click="addToast(true)">
      Add important toast
    </button>
  </div>
  <Snackbar.Portal class="bench-toast-viewport" :namespace>
    <Snackbar.Queue v-slot="{ items }" :namespace>
      <div class="bench-toast-stack" :style="{ height: `${String(height)}px` }">
        <div
          v-for="(item, index) in items"
          :key="item.id"
          class="bench-toast-place"
          :style="style(index)"
        >
          <Snackbar.Root
            :id="item.id"
            class="bench-toast bench-toast-content"
            data-bench="toast"
            :urgent="item.severity === 'error'"
            :namespace
          >
            <Snackbar.Content class="bench-toast-text">
              <p class="bench-toast-title">{{ item.subject }}</p>
              <p class="bench-toast-description">{{ item.body }}</p>
            </Snackbar.Content>
            <Button.Root data-bench="toast-action">Undo</Button.Root>
            <Snackbar.Close data-bench="toast-close" :namespace>Close</Snackbar.Close>
          </Snackbar.Root>
        </div>
      </div>
    </Snackbar.Queue>
  </Snackbar.Portal>
</template>

<style>
.bench-toast-stack,
.bench-toast-place {
  transition: all 300ms cubic-bezier(0, 0, 0.2, 1);
}

.bench-toast-stack {
  position: relative;
}

.bench-toast-place {
  position: absolute;
}
</style>
