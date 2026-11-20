<script setup lang="ts">
import { NavigationMenu } from '../../src/navigation-menu';

// A scoped rule does not reach the default element of a content, whose root is a `<Teleport>`. It
// reaches the element of the `element` slot.
</script>

<template>
  <NavigationMenu.Root default-value="menu">
    <NavigationMenu.List>
      <NavigationMenu.Item value="menu">
        <NavigationMenu.Trigger>Menu</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <template #element="{ props, elementRef }">
            <div v-bind="props" :ref="elementRef" class="content" data-testid="scoped-content">
              Content
            </div>
          </template>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner>
        <NavigationMenu.Popup>
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>

<style scoped>
.content {
  outline: 1px dashed;
}
</style>
