<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import '../../../behavior/style.css';
</script>

<template>
  <div class="bench-page">
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item>
          <NavigationMenu.Trigger data-bench="trigger">Open</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="#item-1">Item 1</NavigationMenu.Link>
            <NavigationMenu.Link href="#item-2">Item 2</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner class="nav-positioner">
          <Transition enter-from-class="bench-hidden" leave-to-class="bench-hidden">
            <NavigationMenu.Popup data-bench="popup" class="bench-motion">
              <NavigationMenu.Arrow />
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </Transition>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  </div>
</template>

<style>
.nav-positioner {
  width: var(--positioner-width);
  height: var(--positioner-height);
}

[data-bench='popup'] {
  transform-origin: var(--transform-origin);
}
</style>
