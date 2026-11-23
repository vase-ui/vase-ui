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
    <Menu.Trigger open-on-hover :class="styles.Button">
      Add to playlist
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :class="styles.Positioner" :side-offset="8" align="start">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass">
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
  </Menu.Root>
</template>
