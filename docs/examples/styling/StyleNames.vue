<script setup lang="ts">
import { Select, SelectPositionerCssVariables } from '@vase-ui/vue/select';

const popupStyle = {
  maxHeight: `var(${SelectPositionerCssVariables.availableHeight})`,
};
</script>

<template>
  <Select.Root>
    <Select.Trigger>
      <Select.Value placeholder="Song" />
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner>
        <Select.Popup :style="popupStyle">
          <Select.Item value="library">Add to Library</Select.Item>
          <Select.Item value="playlist">Add to Playlist</Select.Item>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
