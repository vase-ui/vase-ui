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
        <NavigationMenu.Content>
          <NavigationMenu.Link />
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>

    <NavigationMenu.Portal>
      <NavigationMenu.Backdrop />
      <NavigationMenu.Positioner>
        <NavigationMenu.Popup>
          <NavigationMenu.Arrow />
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
