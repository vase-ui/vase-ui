<script setup lang="ts">
import { Menu, MenuPositionerCssVariables } from '@vase-ui/vue/menu';

const popupStyle = {
  maxHeight: `var(${MenuPositionerCssVariables.availableHeight})`,
};
</script>

<template>
  <Menu.Root>
    <Menu.Trigger>Song</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup :style="popupStyle">
          <Menu.Item>Add to Library</Menu.Item>
          <Menu.Item>Add to Playlist</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
