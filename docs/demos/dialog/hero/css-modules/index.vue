<script setup lang="ts">
import { Dialog } from '@vase-ui/vue/dialog';
import styles from './index.module.css';
</script>

<template>
  <Dialog.Root>
    <Dialog.Trigger :class="styles.Button">View notifications</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop :class="styles.Backdrop" />
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
    </Dialog.Portal>
  </Dialog.Root>
</template>
