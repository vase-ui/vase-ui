<script setup lang="ts">
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import styles from '../../_index.module.css';

const backdropHiddenClass = styles.BackdropHidden;
const popupHiddenClass = styles.PopupHidden;

const demoAlertDialog = AlertDialog.createHandle();
</script>

<template>
  <AlertDialog.Trigger :class="[styles.Button, styles.DangerButton]" :handle="demoAlertDialog">
    Discard draft
  </AlertDialog.Trigger>

  <AlertDialog.Root :handle="demoAlertDialog">
    <AlertDialog.Portal>
      <Transition :enter-from-class="backdropHiddenClass" :leave-to-class="backdropHiddenClass">
        <AlertDialog.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
        <AlertDialog.Popup :class="styles.Popup">
          <div :class="styles.Intro">
            <AlertDialog.Title :class="styles.Title">Discard draft?</AlertDialog.Title>
            <AlertDialog.Description :class="styles.Description">
              This action cannot be undone.
            </AlertDialog.Description>
          </div>
          <div :class="styles.Actions">
            <AlertDialog.Close :class="styles.Button">Cancel</AlertDialog.Close>
            <AlertDialog.Close :class="[styles.Button, styles.DangerButton]">
              Discard
            </AlertDialog.Close>
          </div>
        </AlertDialog.Popup>
      </Transition>
    </AlertDialog.Portal>
  </AlertDialog.Root>
</template>
