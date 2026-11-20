<script setup lang="ts">
import { ContextMenu } from '@vase-ui/vue/context-menu';
import styles from './index.module.css';

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <ContextMenu.Root>
    <ContextMenu.Trigger :class="styles.Trigger">Right click here</ContextMenu.Trigger>
    <ContextMenu.Portal>
      <ContextMenu.Positioner :class="styles.Positioner">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <ContextMenu.Popup :class="styles.Popup">
            <ContextMenu.Item :class="styles.Item">Add to Library</ContextMenu.Item>
            <ContextMenu.Item :class="styles.Item">Add to Playlist</ContextMenu.Item>
            <ContextMenu.Separator :class="styles.Separator" />
            <ContextMenu.Item :class="styles.Item">Play Next</ContextMenu.Item>
            <ContextMenu.Item :class="styles.Item">Play Last</ContextMenu.Item>
            <ContextMenu.Separator :class="styles.Separator" />
            <ContextMenu.Item :class="styles.Item">Favorite</ContextMenu.Item>
            <ContextMenu.Item :class="styles.Item">Share</ContextMenu.Item>
          </ContextMenu.Popup>
        </Transition>
      </ContextMenu.Positioner>
    </ContextMenu.Portal>
  </ContextMenu.Root>
</template>
