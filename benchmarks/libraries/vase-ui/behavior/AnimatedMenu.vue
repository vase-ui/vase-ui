<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <Menu.Root>
      <Menu.Trigger data-bench="trigger">Open</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden" appear>
            <Menu.Popup data-bench="popup" class="bench-motion">
              <Menu.Item>Item 1</Menu.Item>
              <Menu.Item>Item 2</Menu.Item>
              <Menu.Item>Item 3</Menu.Item>
              <Menu.Item>Item 4</Menu.Item>
              <Menu.Item>Item 5</Menu.Item>
            </Menu.Popup>
          </Transition>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </div>
</template>

<style>
[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}
</style>
