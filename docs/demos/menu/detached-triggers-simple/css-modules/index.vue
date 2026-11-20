<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import styles from '../../_index.module.css';

const demoMenu = Menu.createHandle();

const EllipsisHorizontalIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [
      h('circle', { cx: '3', cy: '8', r: '1' }),
      h('circle', { cx: '8', cy: '8', r: '1' }),
      h('circle', { cx: '13', cy: '8', r: '1' }),
    ],
  );

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Menu.Trigger :class="styles.IconButton" :handle="demoMenu" aria-label="Project actions">
    <EllipsisHorizontalIcon />
  </Menu.Trigger>

  <Menu.Root :handle="demoMenu">
    <Menu.Portal>
      <Menu.Positioner :side-offset="8" align="start" :class="styles.Positioner">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Menu.Popup :class="styles.Popup">
            <Menu.Item :class="styles.Item">Rename</Menu.Item>
            <Menu.Item :class="styles.Item">Duplicate</Menu.Item>
            <Menu.Item :class="styles.Item">Move to folder</Menu.Item>
            <Menu.Separator :class="styles.Separator" />
            <Menu.Item :class="styles.Item">Archive</Menu.Item>
            <Menu.Item :class="styles.Item">Delete</Menu.Item>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
