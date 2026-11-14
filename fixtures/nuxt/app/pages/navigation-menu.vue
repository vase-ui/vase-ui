<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
</script>

<template>
  <main>
    <NavigationMenu.Root data-testid="closed-menu">
      <NavigationMenu.List>
        <NavigationMenu.Item value="products">
          <NavigationMenu.Trigger>Products</NavigationMenu.Trigger>
          <NavigationMenu.Content keep-mounted data-testid="kept-content">
            <NavigationMenu.Link href="#kept" data-testid="kept-link">Kept</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="guides">
          <NavigationMenu.Trigger>Guides</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="#unkept" data-testid="unkept-link">
              Unkept
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenuNuxtLink to="/" active data-testid="nuxt-link"
            >Home</NavigationMenuNuxtLink
          >
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenuRouterLink to="/" data-testid="router-link">Home</NavigationMenuRouterLink>
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

    <NavigationMenu.Root default-value="news">
      <NavigationMenu.List>
        <NavigationMenu.Item value="news">
          <NavigationMenu.Trigger data-testid="news-trigger">News</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="news-content">
            <NavigationMenu.Link href="#news">News link</NavigationMenu.Link>
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
  </main>
</template>
