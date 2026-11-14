<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import styles from './index.module.css';

const XIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      style: { display: 'block' },
    },
    [h('path', { d: 'm2.5 2.5 11 11m-11 0 11-11' })],
  );
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger :class="styles.Button">Open dialog</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop :class="styles.Backdrop" />
      <Dialog.Viewport :class="styles.Viewport">
        <Dialog.Popup :class="styles.PopupRoot">
          <Dialog.Close :class="styles.Close" aria-label="Close">
            <XIcon />
          </Dialog.Close>
          <div :class="styles.Popup" />
        </Dialog.Popup>
      </Dialog.Viewport>
    </Dialog.Portal>
  </Dialog.Root>
</template>
