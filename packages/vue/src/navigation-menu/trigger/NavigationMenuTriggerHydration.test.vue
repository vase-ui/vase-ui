<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

withDefaults(defineProps<{ defaultValue?: string | null; keepMounted?: boolean }>(), {
  defaultValue: null,
  keepMounted: false,
});
</script>

<template>
  <NavigationMenu.Root data-testid="root" :default-value="defaultValue">
    <NavigationMenu.List data-testid="list">
      <NavigationMenu.Item value="one" data-testid="item-one">
        <NavigationMenu.Trigger data-testid="trigger-one">One</NavigationMenu.Trigger>
        <NavigationMenu.Content data-testid="content-one" :keep-mounted="keepMounted">
          <NavigationMenu.Link data-testid="link-one" href="#one">Link of one</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
      <NavigationMenu.Item value="two" data-testid="item-two">
        <NavigationMenu.Trigger data-testid="trigger-two">Two</NavigationMenu.Trigger>
        <NavigationMenu.Content data-testid="content-two" :keep-mounted="keepMounted">
          <NavigationMenu.Link data-testid="link-two" href="#two">Link of two</NavigationMenu.Link>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Viewport data-testid="viewport" />
  </NavigationMenu.Root>
</template>
