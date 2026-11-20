<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import styles from './index.module.css';

const popupHiddenClass = styles.PopupHidden;
const popupLeavingClass = styles.PopupLeaving;
</script>

<template>
  <Drawer.Root swipe-direction="right" :modal="false" disable-pointer-dismissal>
    <Drawer.Trigger :class="styles.Button">Open non-modal drawer</Drawer.Trigger>
    <Drawer.Portal>
      <Drawer.Viewport :class="styles.Viewport">
        <Transition
          :enter-from-class="popupHiddenClass"
          :leave-to-class="popupHiddenClass"
          :leave-active-class="popupLeavingClass"
          appear
        >
          <Drawer.Popup :class="styles.Popup">
            <Drawer.Content :class="styles.Content">
              <Drawer.Title :class="styles.Title">Non-modal drawer</Drawer.Title>
              <Drawer.Description :class="styles.Description">
                This drawer does not trap focus and ignores outside clicks. Use the close button or
                swipe to dismiss it.
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
