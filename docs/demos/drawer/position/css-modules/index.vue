<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import styles from './index.module.css';

const backdropHiddenClass = styles.BackdropHidden;
const backdropLeavingClass = styles.BackdropLeaving;
const popupHiddenClass = styles.PopupHidden;
const popupLeavingClass = styles.PopupLeaving;
</script>

<template>
  <Drawer.Root>
    <Drawer.Trigger :class="styles.Button">Open bottom drawer</Drawer.Trigger>
    <Drawer.Portal>
      <Transition
        :enter-from-class="backdropHiddenClass"
        :leave-to-class="backdropHiddenClass"
        :leave-active-class="backdropLeavingClass"
        appear
      >
        <Drawer.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Drawer.Viewport :class="styles.Viewport">
        <Transition
          :enter-from-class="popupHiddenClass"
          :leave-to-class="popupHiddenClass"
          :leave-active-class="popupLeavingClass"
          appear
        >
          <Drawer.Popup :class="styles.Popup">
            <div :class="styles.Handle" />
            <Drawer.Content :class="styles.Content">
              <Drawer.Title :class="styles.Title">Notifications</Drawer.Title>
              <Drawer.Description :class="styles.Description">
                You are all caught up. Good job!
              </Drawer.Description>
              <div :class="styles.Actions">
                <Drawer.Close :class="styles.Button">Close</Drawer.Close>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Transition>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
