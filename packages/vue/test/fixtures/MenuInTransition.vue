<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// A menu and its submenu, each popup in a `<Transition>` with a long leave.
defineProps({ root: Object as PropType<Props> });
</script>

<template>
  <Menu.Root v-bind="root">
    <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Transition name="menu-fade">
          <Menu.Popup data-testid="popup">
            <Menu.Item data-key="a">a</Menu.Item>
            <Menu.SubmenuRoot>
              <Menu.SubmenuTrigger data-key="sub" :delay="0">More</Menu.SubmenuTrigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Transition name="menu-fade">
                    <Menu.Popup data-testid="sub-popup">
                      <Menu.Item data-key="s1">s1</Menu.Item>
                    </Menu.Popup>
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
.menu-fade-leave-active {
  transition: opacity 400ms;
}
.menu-fade-leave-to {
  opacity: 0;
}
</style>
