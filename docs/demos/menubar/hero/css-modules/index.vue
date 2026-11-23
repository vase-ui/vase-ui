<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import { Menubar } from '@vase-ui/vue/menubar';
import styles from './index.module.css';

function handleClick(event: MouseEvent) {
  if (event.currentTarget instanceof HTMLElement) {
    console.log(`${event.currentTarget.textContent} clicked`);
  }
}

const CaretRightIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M6 12V4l4.5 4z' })],
  );

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Menubar :class="styles.Menubar">
    <Menu.Root>
      <Menu.Trigger :class="styles.MenuTrigger">File</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner :class="styles.MenuPositioner" :side-offset="4">
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Menu.Popup :class="styles.MenuPopup">
              <Menu.Item :class="styles.MenuItem" @click="handleClick">New</Menu.Item>
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Open</Menu.Item>
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Save</Menu.Item>

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger :class="styles.SubmenuTrigger">
                  Export
                  <CaretRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner
                    :class="styles.MenuPositioner"
                    :side-offset="-4"
                    :align-offset="-4"
                  >
                    <Transition
                      :enter-from-class="popupHiddenClass"
                      :leave-to-class="popupHiddenClass"
                    >
                      <Menu.Popup :class="styles.MenuPopup">
                        <Menu.Item :class="styles.MenuItem" @click="handleClick">PDF</Menu.Item>
                        <Menu.Item :class="styles.MenuItem" @click="handleClick">PNG</Menu.Item>
                        <Menu.Item :class="styles.MenuItem" @click="handleClick">SVG</Menu.Item>
                      </Menu.Popup>
                    </Transition>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.Separator :class="styles.MenuSeparator" />
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Print</Menu.Item>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>

    <Menu.Root>
      <Menu.Trigger :class="styles.MenuTrigger">Edit</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner :class="styles.MenuPositioner" :side-offset="4">
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Menu.Popup :class="styles.MenuPopup">
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Cut</Menu.Item>
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Copy</Menu.Item>
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Paste</Menu.Item>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>

    <Menu.Root>
      <Menu.Trigger :class="styles.MenuTrigger">View</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner :class="styles.MenuPositioner" :side-offset="4">
          <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
            <Menu.Popup :class="styles.MenuPopup">
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Zoom In</Menu.Item>
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Zoom Out</Menu.Item>

              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger :class="styles.SubmenuTrigger">
                  Layout
                  <CaretRightIcon />
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner
                    :class="styles.MenuPositioner"
                    :side-offset="-4"
                    :align-offset="-4"
                  >
                    <Transition
                      :enter-from-class="popupHiddenClass"
                      :leave-to-class="popupHiddenClass"
                    >
                      <Menu.Popup :class="styles.MenuPopup">
                        <Menu.Item :class="styles.MenuItem" @click="handleClick"
                          >Single Page</Menu.Item
                        >
                        <Menu.Item :class="styles.MenuItem" @click="handleClick"
                          >Two Pages</Menu.Item
                        >
                        <Menu.Item :class="styles.MenuItem" @click="handleClick"
                          >Continuous</Menu.Item
                        >
                      </Menu.Popup>
                    </Transition>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>

              <Menu.Separator :class="styles.MenuSeparator" />
              <Menu.Item :class="styles.MenuItem" @click="handleClick">Full Screen</Menu.Item>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>

    <Menu.Root disabled>
      <Menu.Trigger :class="styles.MenuTrigger">Help</Menu.Trigger>
    </Menu.Root>
  </Menubar>
</template>
