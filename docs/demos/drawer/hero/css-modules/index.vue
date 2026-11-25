<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import styles from './index.module.css';

const backdropHiddenClass = styles.BackdropHidden;
const backdropLeavingClass = styles.BackdropLeaving;
const popupHiddenClass = styles.PopupHidden;
const popupLeavingClass = styles.PopupLeaving;
</script>

<template>
  <Drawer.Root swipe-direction="right">
    <Drawer.Trigger :class="styles.Button">Open drawer</Drawer.Trigger>
    <Drawer.Portal>
      <Transition
        :enter-from-class="backdropHiddenClass"
        :leave-to-class="backdropHiddenClass"
        :leave-active-class="backdropLeavingClass"
      >
        <Drawer.Backdrop :class="styles.Backdrop" />
      </Transition>
      <Drawer.Viewport :class="styles.Viewport">
        <Transition
          :enter-from-class="popupHiddenClass"
          :leave-to-class="popupHiddenClass"
          :leave-active-class="popupLeavingClass"
        >
          <Drawer.Popup :class="styles.Popup">
            <Drawer.Content :class="styles.Content">
              <Drawer.Title :class="styles.Title">Drawer</Drawer.Title>
              <Drawer.Description :class="styles.Description">
                This is a drawer that slides in from the side. You can swipe to dismiss it.
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
