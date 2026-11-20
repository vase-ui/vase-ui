<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import styles from './index.module.css';

const backdropHiddenClass = styles.BackdropHidden;
const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger :class="styles.Button">View notifications</Dialog.Trigger>
    <Dialog.Portal>
      <Transition
        :enter-from-class="backdropHiddenClass"
        :leave-to-class="backdropHiddenClass"
        appear
      >
        <Dialog.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
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
