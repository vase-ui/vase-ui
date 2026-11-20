<script setup lang="ts">
import { provide, shallowReactive } from 'vue';
import {
  createMemoryHistory,
  createRouter,
  RouterLink,
  routeLocationKey,
  routerKey,
} from 'vue-router';
import { NavigationMenu } from '../../src/navigation-menu';

// Two router links in a content, each a native `<a>` in the `element` slot of a link, in the slot
// of `<RouterLink custom>`. The current route is `/start`.
const router = createRouter({
  history: createMemoryHistory(),
  routes: ['/start', '/guide'].map((path) => ({ path, component: { render: () => null } })),
});
void router.push('/start');
provide(routerKey, router);
// The route that `app.use(router)` gives: each key reads the current route.
const route = {};
for (const key of Object.keys(router.currentRoute.value)) {
  Object.defineProperty(route, key, {
    enumerable: true,
    get: () => router.currentRoute.value[key as keyof typeof router.currentRoute.value],
  });
}
provide(routeLocationKey, shallowReactive(route) as typeof router.currentRoute.value);
const links = [
  { to: '/start', text: 'Start' },
  { to: '/guide', text: 'Guide' },
];
</script>

<template>
  <NavigationMenu.Root default-value="docs">
    <NavigationMenu.List>
      <NavigationMenu.Item value="docs">
        <NavigationMenu.Trigger>Docs</NavigationMenu.Trigger>
        <NavigationMenu.Content>
          <RouterLink
            v-for="link in links"
            :key="link.to"
            v-slot="{ href, navigate, isExactActive }"
            :to="link.to"
            custom
          >
            <NavigationMenu.Link>
              <template #element="{ props, elementRef }">
                <a
                  v-bind="props"
                  :ref="elementRef"
                  :href="href"
                  :aria-current="isExactActive ? 'page' : undefined"
                  @click="navigate"
                >
                  {{ link.text }}
                </a>
              </template>
            </NavigationMenu.Link>
          </RouterLink>
        </NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner data-testid="positioner">
        <NavigationMenu.Popup data-testid="popup">
          <NavigationMenu.Viewport />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>
