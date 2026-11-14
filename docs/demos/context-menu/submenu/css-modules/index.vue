<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import styles from './index.module.css';

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
</script>

<template>
  <ContextMenu.Root>
    <ContextMenu.Trigger :class="styles.Trigger">Right click here</ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Positioner :class="styles.Positioner">
        <ContextMenu.Popup :class="styles.Popup">
          <ContextMenu.Item :class="styles.Item">Add to Library</ContextMenu.Item>

          <ContextMenu.SubmenuRoot>
            <ContextMenu.SubmenuTrigger :class="styles.SubmenuTrigger">
              Add to Playlist
              <CaretRightIcon />
            </ContextMenu.SubmenuTrigger>
            <ContextMenu.Portal>
              <ContextMenu.Positioner
                :class="styles.Positioner"
                :align-offset="-4"
                :side-offset="-4"
              >
                <ContextMenu.Popup :class="styles.SubmenuPopup">
                  <ContextMenu.Item :class="styles.Item">Get Up!</ContextMenu.Item>
                  <ContextMenu.Item :class="styles.Item">Inside Out</ContextMenu.Item>
                  <ContextMenu.Item :class="styles.Item">Night Beats</ContextMenu.Item>
                  <ContextMenu.Separator :class="styles.Separator" />
                  <ContextMenu.Item :class="styles.Item">New playlist…</ContextMenu.Item>
                </ContextMenu.Popup>
              </ContextMenu.Positioner>
            </ContextMenu.Portal>
          </ContextMenu.SubmenuRoot>

          <ContextMenu.Separator :class="styles.Separator" />
          <ContextMenu.Item :class="styles.Item">Play Next</ContextMenu.Item>
          <ContextMenu.Item :class="styles.Item">Play Last</ContextMenu.Item>
          <ContextMenu.Separator :class="styles.Separator" />
          <ContextMenu.Item :class="styles.Item">Favorite</ContextMenu.Item>
          <ContextMenu.Item :class="styles.Item">Share</ContextMenu.Item>
        </ContextMenu.Popup>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
</template>
