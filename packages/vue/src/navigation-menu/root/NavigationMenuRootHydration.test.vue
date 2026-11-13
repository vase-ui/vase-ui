<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

withDefaults(defineProps<{ defaultValue?: string | null }>(), { defaultValue: null });
</script>

<template>
  <NavigationMenu.Root data-testid="root" :default-value="defaultValue">
    <NavigationMenu.List data-testid="list">
      <NavigationMenu.Item value="item-1">
        <NavigationMenu.Link data-testid="link-1" href="#link-1" active>Link 1</NavigationMenu.Link>
        <NavigationMenu.Icon data-testid="icon-1" />
      </NavigationMenu.Item>
      <NavigationMenu.Item value="item-2">
        <NavigationMenu.Link data-testid="link-2" href="#link-2">Link 2</NavigationMenu.Link>
        <NavigationMenu.Icon data-testid="icon-2" />
      </NavigationMenu.Item>
    </NavigationMenu.List>
  </NavigationMenu.Root>
</template>
