<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger :class="$style.Button">Song</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :class="$style.Positioner" :side-offset="8">
        <Menu.Popup :class="$style.Popup">
          <Menu.Item :class="$style.Item">Add to Library</Menu.Item>
          <Menu.Item :class="$style.Item">Add to Playlist</Menu.Item>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>

<style module>
.Button {
  height: 2rem;
  padding: 0 0.75rem;
}

.Positioner {
  outline: 0;
}

.Popup {
  padding: 0.25rem 0;
  transition: opacity 150ms;
}

.Popup[data-starting-style],
.Popup[data-ending-style] {
  opacity: 0;
}

.Item {
  padding: 0.5rem 1rem;
}

.Item[data-highlighted] {
  outline: 1px solid currentColor;
}
</style>
