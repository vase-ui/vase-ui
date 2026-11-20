<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';
import styles from './index.module.css';

const portalContainer = useTemplateRef<HTMLDivElement>('portalContainer');
</script>

<template>
  <div ref="portalContainer" :class="styles.Root">
    <Drawer.Root swipe-direction="right" :modal="false">
      <Drawer.SwipeArea :class="styles.SwipeArea">
        <span :class="styles.SwipeLabel">Swipe here</span>
      </Drawer.SwipeArea>
      <div :class="styles.Center">
        <div :class="styles.Instructions">
          <p :class="styles.Hint">Swipe from the right edge to open the drawer.</p>
        </div>
      </div>
      <Drawer.Portal :to="portalContainer">
        <Transition
          :enter-from-class="styles.BackdropHidden"
          :leave-to-class="styles.BackdropHidden"
          :leave-active-class="styles.BackdropLeaving"
          appear
        >
          <Drawer.Backdrop :class="styles.Backdrop" />
        </Transition>
        <Drawer.Viewport :class="styles.Viewport">
          <Transition
            :enter-from-class="styles.PopupHidden"
            :leave-to-class="styles.PopupHidden"
            :leave-active-class="styles.PopupLeaving"
            appear
          >
            <Drawer.Popup :class="styles.Popup">
              <Drawer.Content :class="styles.Content">
                <Drawer.Title :class="styles.Title">Library</Drawer.Title>
                <Drawer.Description :class="styles.Description">
                  Swipe from the edge whenever you want to jump back into your playlists.
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
  </div>
</template>
