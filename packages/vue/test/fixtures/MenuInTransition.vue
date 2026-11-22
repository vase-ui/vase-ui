<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// A menu with the items `a`, `sub` and `b`. `sub` opens a submenu. Each popup is in a
// `<Transition>` with a leave of 400 ms. Vue runs no transition for a kept popup, so an animation of
// `[hidden]` of 10 s is its leave.
defineProps({
  root: Object as PropType<Props>,
  trigger: Object as PropType<Props>,
  portal: Object as PropType<Props>,
});
</script>

<template>
  <Menu.Root v-bind="root">
    <Menu.Trigger data-testid="trigger" v-bind="trigger">Menu</Menu.Trigger>
    <Menu.Portal v-bind="portal">
      <Menu.Positioner>
        <Transition name="menu-fade">
          <Menu.Popup data-testid="popup" class="menu-fade-popup">
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
            <Menu.Item data-key="b">b</Menu.Item>
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
.menu-fade-popup[hidden] {
  display: block;
  animation: menu-fade-hide 10s forwards;
}
@keyframes menu-fade-hide {
  to {
    opacity: 0;
  }
}
</style>
