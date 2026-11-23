<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import styles from '../../_index.module.css';

const backdropHiddenClass = styles.BackdropHidden;
const popupHiddenClass = styles.PopupHidden;

const demoDialog = Dialog.createHandle();
</script>

<template>
  <Dialog.Trigger :class="styles.Button" :handle="demoDialog">View notifications</Dialog.Trigger>

  <Dialog.Root :handle="demoDialog">
    <Dialog.Portal>
      <Transition :enter-from-class="backdropHiddenClass" :leave-to-class="backdropHiddenClass">
        <Dialog.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
        <Dialog.Popup :class="styles.Popup">
          <div :class="styles.Intro">
            <Dialog.Title :class="styles.Title">Notifications</Dialog.Title>
            <Dialog.Description :class="styles.Description">
              You are all caught up. Good job!
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
