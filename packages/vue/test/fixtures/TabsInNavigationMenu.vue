<script setup lang="ts">
import { NavigationMenu } from '../../src/navigation-menu';
import { Tabs } from '../../src/tabs';
</script>

<template>
  <NavigationMenu.Root default-value="menu">
    <NavigationMenu.List>
      <NavigationMenu.Item value="menu">
        <NavigationMenu.Trigger>Menu</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <Tabs.Root default-value="overview">
            <Tabs.List>
              <Tabs.Tab value="overview">Overview</Tabs.Tab>
              <Tabs.Tab value="projects">Projects</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="overview">Overview panel</Tabs.Panel>
            <Tabs.Panel value="projects">Projects panel</Tabs.Panel>
          </Tabs.Root>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner data-testid="positioner">
        <NavigationMenu.Popup>
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
