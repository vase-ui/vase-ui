<script setup lang="ts">
import { h, shallowRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { Menu } from '@vase-ui/vue/menu';
import styles from './index.module.css';

const dialogOpen = shallowRef(false);
const backdropHiddenClass = styles.BackdropHidden;
const menuPopupHiddenClass = styles.MenuPopupHidden;
const dialogPopupHiddenClass = styles.DialogPopupHidden;

const CaretDownIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M12 6H4l4 4.5z' })],
  );
</script>

<template>
  <Menu.Root>
    <Menu.Trigger :class="styles.Button">
      Playlist
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :class="styles.Positioner" :side-offset="8" align="start">
        <Transition
          :enter-from-class="menuPopupHiddenClass"
          :leave-to-class="menuPopupHiddenClass"
          appear
        >
          <Menu.Popup :class="styles.MenuPopup">
            <Menu.Item :class="styles.MenuItem">Play</Menu.Item>
            <Menu.Item :class="styles.MenuItem">Share</Menu.Item>
            <Menu.Separator :class="styles.Separator" />
            <Menu.Item :class="styles.MenuItem" @click="dialogOpen = true">Details…</Menu.Item>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>

  <Dialog.Root v-model:open="dialogOpen">
    <Dialog.Portal>
      <Transition
        :enter-from-class="backdropHiddenClass"
        :leave-to-class="backdropHiddenClass"
        appear
      >
        <Dialog.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Transition
        :enter-from-class="dialogPopupHiddenClass"
        :leave-to-class="dialogPopupHiddenClass"
        appear
      >
        <Dialog.Popup :class="styles.DialogPopup">
          <div :class="styles.Intro">
            <Dialog.Title :class="styles.Title">Playlist details</Dialog.Title>
            <Dialog.Description :class="styles.Description">
              This playlist contains 24 songs and was last updated today.
            </Dialog.Description>
          </div>
          <div :class="styles.Actions">
            <Dialog.Close :class="styles.Button">Close</Dialog.Close>
          </div>
        </Dialog.Popup>
      </Transition>
    </Dialog.Portal>
  </Dialog.Root>
</template>
