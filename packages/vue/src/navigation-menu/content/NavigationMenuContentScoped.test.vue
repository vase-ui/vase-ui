<script setup lang="ts">
import { NavigationMenu } from '../index';
</script>

<template>
  <NavigationMenu.Root>
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
        <NavigationMenu.Content keep-mounted class="content" data-testid="content">
          Content
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
  </NavigationMenu.Root>
</template>

<style scoped>
.content {
  outline-style: dashed;
}
</style>
