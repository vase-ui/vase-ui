<script setup lang="ts">
import { h, shallowRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Menu } from '@vase-ui/vue/menu';
import styles from './index.module.css';

const dialogOpen = shallowRef(false);
const backdropHiddenClass = styles.BackdropHidden;
const popupHiddenClass = styles.DialogPopupHidden;

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

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Menu.Root>
    <Menu.Trigger :class="styles.Button">
      Playlist
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :class="styles.Positioner" :side-offset="8" align="start">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Menu.Popup :class="styles.MenuPopup">
            <Menu.Item :class="styles.MenuItem">Play</Menu.Item>
            <Menu.Item :class="styles.MenuItem">Share</Menu.Item>
            <Menu.Separator :class="styles.Separator" />
            <Menu.Item :class="styles.MenuItem" @click="dialogOpen = true">Delete…</Menu.Item>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>

  <AlertDialog.Root v-model:open="dialogOpen">
    <AlertDialog.Portal>
      <Transition
        :enter-from-class="backdropHiddenClass"
        :leave-to-class="backdropHiddenClass"
        appear
      >
        <AlertDialog.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
        <AlertDialog.Popup :class="styles.DialogPopup">
          <div :class="styles.Intro">
            <AlertDialog.Title :class="styles.Title">Delete playlist?</AlertDialog.Title>
            <AlertDialog.Description :class="styles.Description">
              You can't undo this action.
            </AlertDialog.Description>
          </div>
          <div :class="styles.Actions">
            <AlertDialog.Close :class="styles.Button">Cancel</AlertDialog.Close>
            <AlertDialog.Close data-color="red" :class="styles.Button">Delete</AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </Transition>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
