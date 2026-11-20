<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import styles from './index.module.css';

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

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Menu.Root>
    <Menu.Trigger :class="styles.Button">
      Song
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner
        :class="styles.Positioner"
        :side-offset="({ side }) => (side === 'top' ? 12 : 8)"
      >
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Menu.Popup :class="styles.Popup">
            <Menu.Arrow :class="styles.Arrow" />
            <Menu.Item :class="styles.Item">Add to Library</Menu.Item>
            <Menu.Item :class="styles.Item">Add to Playlist</Menu.Item>
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
