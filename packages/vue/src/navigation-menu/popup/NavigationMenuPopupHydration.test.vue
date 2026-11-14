<script setup lang="ts">
import * as NavigationMenu from '../index.parts';

withDefaults(defineProps<{ defaultValue?: string | null; keepMounted?: boolean }>(), {
  defaultValue: null,
  keepMounted: false,
});
</script>

<template>
  <NavigationMenu.Root :default-value="defaultValue">
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger data-testid="trigger-one">One</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <NavigationMenu.Link data-testid="link-one" href="#one">Link of one</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Backdrop data-testid="backdrop" />
    <NavigationMenu.Portal :keep-mounted="keepMounted">
      <NavigationMenu.Positioner data-testid="positioner">
        <NavigationMenu.Popup data-testid="popup">
          <NavigationMenu.Arrow />
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
