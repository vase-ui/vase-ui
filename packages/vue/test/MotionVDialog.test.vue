<script setup lang="ts">
import { animate } from 'motion-v';
import { Dialog } from '../src/dialog';

// A dialog whose popup enters and leaves with motion-v in the JavaScript hooks of `<Transition>`.
const props = defineProps<{
  open: boolean;
  /** The duration of each animation, in seconds. */
  duration: number;
}>();

const emit = defineEmits<{
  'update:open': [open: boolean];
  afterLeave: [];
}>();

function enter(element: Element, done: () => void) {
  void animate(element, { opacity: [0, 1] }, { duration: props.duration }).then(done);
}

function leave(element: Element, done: () => void) {
  void animate(element, { opacity: 0 }, { duration: props.duration, ease: 'linear' }).then(done);
}
</script>

<template>
  <Dialog.Root :open="open" @update:open="emit('update:open', $event)">
    <Dialog.Portal>
      <Transition
        :css="false"
        appear
        @enter="enter"
        @leave="leave"
        @after-leave="emit('afterLeave')"
      >
        <Dialog.Popup data-testid="popup">
          <Dialog.Title>Title</Dialog.Title>
        </Dialog.Popup>
      </Transition>
    </Dialog.Portal>
  </Dialog.Root>
</template>
