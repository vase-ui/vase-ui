<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Drawer } from '@vase-ui/vue/drawer';
import styles from './index.module.css';

const portalContainer = useTemplateRef<HTMLDivElement>('portalContainer');

const backdropHiddenClass = styles.BackdropHidden;
const backdropLeavingClass = styles.BackdropLeaving;
const popupHiddenClass = styles.PopupHidden;
const popupLeavingClass = styles.PopupLeaving;
</script>

<template>
  <Drawer.Provider>
    <div ref="portalContainer" :class="styles.Root">
      <Drawer.IndentBackground :class="styles.IndentBackground" />
      <Drawer.Indent :class="styles.Indent">
        <div :class="styles.Center">
          <Drawer.Root :modal="false">
            <Drawer.Trigger :class="styles.Button">Open drawer</Drawer.Trigger>
            <Drawer.Portal :to="portalContainer">
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
        </div>
      </Drawer.Indent>
    </div>
  </Drawer.Provider>
</template>
