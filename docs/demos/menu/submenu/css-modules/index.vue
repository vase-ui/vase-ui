<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import styles from './index.module.css';

function getOffset({ side }: { side: Menu.Positioner.Props['side'] }) {
  return side === 'top' || side === 'bottom' ? 4 : -4;
}

const CaretDownIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M12 6H4l4 4.5z' })],
  );

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
  <Menu.Root>
    <Menu.Trigger :class="styles.Button">
      Song
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :class="styles.Positioner" :side-offset="8" align="start">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
          <Menu.Popup :class="styles.Popup">
            <Menu.Item :class="styles.Item">Add to Library</Menu.Item>

            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger :class="styles.SubmenuTrigger">
                Add to Playlist
                <CaretRightIcon />
              </Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner
                  :class="styles.Positioner"
                  :side-offset="getOffset"
                  :align-offset="getOffset"
                >
                  <Transition
                    :enter-from-class="popupHiddenClass"
                    :leave-to-class="popupHiddenClass"
                  >
                    <Menu.Popup :class="styles.Popup">
                      <Menu.Item :class="styles.Item">Get Up!</Menu.Item>
                      <Menu.Item :class="styles.Item">Inside Out</Menu.Item>
                      <Menu.Item :class="styles.Item">Night Beats</Menu.Item>
                      <Menu.Separator :class="styles.Separator" />
                      <Menu.Item :class="styles.Item">New playlist…</Menu.Item>
                    </Menu.Popup>
                  </Transition>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>

            <Menu.Separator :class="styles.Separator" />
            <Menu.Item :class="styles.Item">Play Next</Menu.Item>
            <Menu.Item :class="styles.Item">Play Last</Menu.Item>
            <Menu.Separator :class="styles.Separator" />
            <Menu.Item :class="styles.Item">Favorite</Menu.Item>
            <Menu.Item :class="styles.Item">Share</Menu.Item>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
