<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

// A menu that is open while `scene.open`, with a submenu that renders while `scene.submenu` and is
// open while `scene.submenuOpen`. Each popup is in a `<Transition>`: the menu leaves in 300 ms,
// and the submenu in 10 s.
defineProps({
  scene: {
    type: Object as PropType<{ open: boolean; submenu: boolean; submenuOpen: boolean }>,
    required: true,
  },
});
</script>

<template>
  <Menu.Root :open="scene.open">
    <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Transition name="menu-quick">
          <Menu.Popup data-testid="popup">
            <Menu.Item>a</Menu.Item>
            <Menu.SubmenuRoot v-if="scene.submenu" :open="scene.submenuOpen">
              <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Transition name="menu-slow">
                    <Menu.Popup data-testid="sub-popup"><Menu.Item>s1</Menu.Item></Menu.Popup>
                  </Transition>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.SubmenuRoot>
          </Menu.Popup>
        </Transition>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>

<style>
.menu-quick-leave-active {
  transition: opacity 300ms;
}
.menu-slow-leave-active {
  transition: opacity 10s;
}
.menu-quick-leave-to,
.menu-slow-leave-to {
  opacity: 0;
}
</style>
