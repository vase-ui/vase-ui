<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import styles from './index.module.css';

const backdropHiddenClass = styles.BackdropHidden;
const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <AlertDialog.Root>
    <AlertDialog.Trigger data-color="red" :class="styles.Button">Discard draft</AlertDialog.Trigger>
    <AlertDialog.Portal>
      <Transition
        :enter-from-class="backdropHiddenClass"
        :leave-to-class="backdropHiddenClass"
        appear
      >
        <AlertDialog.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
        <AlertDialog.Popup :class="styles.Popup">
          <div :class="styles.Intro">
            <AlertDialog.Title :class="styles.Title">Discard draft?</AlertDialog.Title>
            <AlertDialog.Description :class="styles.Description">
              You can't undo this action.
            </AlertDialog.Description>
          </div>
          <div :class="styles.Actions">
            <AlertDialog.Close :class="styles.Button">Cancel</AlertDialog.Close>
            <AlertDialog.Close data-color="red" :class="styles.Button">Discard</AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </Transition>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
