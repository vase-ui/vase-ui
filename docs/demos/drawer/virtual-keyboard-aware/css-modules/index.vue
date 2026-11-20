<script setup lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';
import styles from './index.module.css';

const fields = [
  ['Name', 'Ada Lovelace'],
  ['Phone', '+1 (555) 123-4567'],
  ['Street address', '12 Computing Way'],
  ['Apartment', 'Unit 4B'],
  ['City', 'San Francisco'],
  ['Postal code', '94107'],
  ['Delivery window', 'After 6 PM'],
  ['Backup contact', 'Grace Hopper'],
];

const backdropHiddenClass = styles.BackdropHidden;
const backdropLeavingClass = styles.BackdropLeaving;
const popupHiddenClass = styles.PopupHidden;
const popupLeavingClass = styles.PopupLeaving;
</script>

<template>
  <Drawer.Root>
    <Drawer.Trigger :class="styles.Button">Open keyboard-aware drawer</Drawer.Trigger>
    <Drawer.VirtualKeyboardProvider>
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
              <div :class="styles.Header">
                <div :class="styles.Handle" />
                <div :class="styles.HeaderActions">
                  <Drawer.Close :class="[styles.Button, styles.HeaderButton]">Cancel</Drawer.Close>
                  <Drawer.Title :class="styles.Title">Delivery details</Drawer.Title>
                  <Drawer.Close :class="[styles.Button, styles.HeaderButton]">Save</Drawer.Close>
                </div>
              </div>

              <Drawer.Content :class="styles.Scroll">
                <div :class="styles.Form">
                  <label v-for="[label, placeholder] in fields" :key="label" :class="styles.Field">
                    <span :class="styles.FieldLabel">{{ label }}</span>
                    <input :class="styles.Input" :placeholder="placeholder" type="text" />
                  </label>

                  <label :class="styles.Field">
                    <span :class="styles.FieldLabel">Instructions</span>
                    <textarea
                      :class="styles.Textarea"
                      placeholder="Gate code, drop-off spot, or anything else the driver should know"
                    />
                  </label>
                </div>
              </Drawer.Content>

              <div :class="styles.FooterSlot">
                <div :class="styles.StickyFooter">
                  <label :class="styles.Composer">
                    <span :class="styles.FieldLabel">Delivery note</span>
                    <input
                      :class="styles.ComposerInput"
                      placeholder="Add a note for the driver"
                      type="text"
                    />
                  </label>
                </div>
              </div>
            </Drawer.Popup>
          </Transition>
        </Drawer.Viewport>
      </Drawer.Portal>
    </Drawer.VirtualKeyboardProvider>
  </Drawer.Root>
</template>
