<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger :class="$style.Button">Song</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :class="$style.Positioner" :side-offset="8">
        <Transition
          :enter-from-class="$style.PopupHidden"
          :leave-to-class="$style.PopupHidden"
          appear
        >
          <Menu.Popup :class="$style.Popup">
            <Menu.Item :class="$style.Item">Add to Library</Menu.Item>
            <Menu.Item :class="$style.Item">Add to Playlist</Menu.Item>
          </Menu.Popup>
        </Transition>
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

.PopupHidden {
  opacity: 0;
}

.Item {
  padding: 0.5rem 1rem;
}

.Item[data-highlighted] {
  outline: 1px solid currentColor;
}
</style>
