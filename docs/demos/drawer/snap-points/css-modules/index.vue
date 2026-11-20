<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import styles from './index.module.css';

const TOP_MARGIN_REM = 1;
const VISIBLE_SNAP_POINTS_REM = [30];

function toViewportSnapPoint(heightRem: number) {
  return `${heightRem + TOP_MARGIN_REM}rem`;
}

const snapPoints = [...VISIBLE_SNAP_POINTS_REM.map(toViewportSnapPoint), 1];

const backdropHiddenClass = styles.BackdropHidden;
const backdropLeavingClass = styles.BackdropLeaving;
const popupHiddenClass = styles.PopupHidden;
const popupLeavingClass = styles.PopupLeaving;
</script>

<template>
  <Drawer.Root :snap-points="snapPoints">
    <Drawer.Trigger :class="styles.Button">Open snap drawer</Drawer.Trigger>
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
          <Drawer.Popup :class="styles.Popup" :style="{ '--top-margin': `${TOP_MARGIN_REM}rem` }">
            <div :class="styles.DragArea">
              <div :class="styles.Handle" />
              <Drawer.Title :class="styles.Title">Snap points</Drawer.Title>
            </div>
            <Drawer.Content :class="styles.Scroll">
              <div :class="styles.Content">
                <Drawer.Description :class="styles.Description">
                  Drag the sheet to snap between a compact peek and a near full-height view.
                </Drawer.Description>
                <div :class="styles.Cards" aria-hidden="true">
                  <div v-for="index in 20" :key="index" :class="styles.Card" />
                </div>
                <div :class="styles.Actions">
                  <Drawer.Close :class="styles.Button">Close</Drawer.Close>
                </div>
              </div>
            </Drawer.Content>
          </Drawer.Popup>
        </Transition>
      </Drawer.Viewport>
    </Drawer.Portal>
  </Drawer.Root>
</template>
