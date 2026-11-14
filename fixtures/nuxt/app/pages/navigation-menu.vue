<script setup lang="ts">
import { NuxtLink } from '#components';
// No entry point of the package exports Navigation Menu yet, so the page imports its parts by
// their path.
import * as NavigationMenu from '../../../../packages/vue/src/navigation-menu/index.parts';
</script>

<template>
  <main>
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="kept">
          <NavigationMenu.Trigger data-testid="kept-trigger">Kept</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="kept-content" keep-mounted>
            <NavigationMenu.Link data-testid="kept-link" href="#kept">Kept link</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="dropped">
          <NavigationMenu.Trigger data-testid="dropped-trigger">Dropped</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link data-testid="dropped-link" href="#dropped">
              Dropped link
            </NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link data-testid="nuxt-link" :as="NuxtLink" to="/button" active>
            Button
          </NavigationMenu.Link>
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

    <NavigationMenu.Root default-value="open">
      <NavigationMenu.List>
        <NavigationMenu.Item value="open">
          <NavigationMenu.Trigger data-testid="open-trigger">Open</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link data-testid="open-link" href="#open">Open link</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup data-testid="open-popup">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  </main>
</template>
