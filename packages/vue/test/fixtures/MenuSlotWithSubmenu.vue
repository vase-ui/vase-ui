<script setup lang="ts">
import { Menu } from '../../src/menu';

// A menu whose popup renders a `<div>` in its `element` slot, with the items `a` and `sub`. `sub`
// opens a submenu in a `<Transition>` with a leave of 400 ms.
</script>

<template>
  <Menu.Root>
    <Menu.Trigger data-testid="trigger">Menu</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup>
          <template #element="{ props, elementRef }">
            <div v-bind="props" :ref="elementRef" data-testid="popup">
              <Menu.Item data-key="a">a</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-key="sub" :delay="0">More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Transition name="slot-menu-fade">
                      <Menu.Popup data-testid="sub-popup">
                        <Menu.Item data-key="s1">s1</Menu.Item>
                      </Menu.Popup>
                    </Transition>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </div>
          </template>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>

<style>
.slot-menu-fade-leave-active {
  transition: opacity 400ms;
}
.slot-menu-fade-leave-to {
  opacity: 0;
}
</style>
