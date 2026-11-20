<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';
import { animate } from 'motion-v';
import styles from './index.module.css';

function enter(element: Element, done: () => void) {
  void animate(element, { opacity: [0, 1], scale: [0.8, 1] }).then(done);
}

function leave(element: Element, done: () => void) {
  void animate(element, { opacity: 0, scale: 0.8 }).then(done);
}
</script>

<template>
  <Popover.Root>
    <Popover.Trigger :class="styles.Trigger">Trigger</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner :class="styles.Positioner" :side-offset="8">
        <Transition :css="false" appear @enter="enter" @leave="leave">
          <Popover.Popup :class="styles.Popup" aria-label="Animated popover">Popup</Popover.Popup>
        </Transition>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
