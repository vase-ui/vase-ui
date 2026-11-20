<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
</script>

<template>
  <NavigationMenu.Root>
    <NavigationMenu.List>
      <NavigationMenu.Item>
        <NavigationMenu.Trigger>
          <NavigationMenu.Icon />
        </NavigationMenu.Trigger>
        <NavigationMenu.Content :transition="{ name: 'slide' }">
          <NavigationMenu.Link />
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>

    <NavigationMenu.Portal>
      <Transition appear>
        <NavigationMenu.Backdrop />
      </Transition>
      <NavigationMenu.Positioner>
        <Transition appear>
          <NavigationMenu.Popup>
            <NavigationMenu.Arrow />
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </Transition>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
