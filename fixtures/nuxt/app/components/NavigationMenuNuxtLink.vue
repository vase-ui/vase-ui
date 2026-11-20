<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import type { RouteLocationRaw } from 'vue-router';

// A native `<a>` in the `element` slot of the link, in the slot of `<NuxtLink custom>`, so that the
// arrow keys of the menu reach it. The `<a>` of the current route has `aria-current="page"`. The
// attributes and `closeOnClick` go to the link, which merges them with its own.
defineOptions({ inheritAttrs: false });
defineProps<{ to: RouteLocationRaw }>();
</script>

<template>
  <NuxtLink v-slot="{ href, navigate, isExactActive }" :to="to" custom>
    <NavigationMenu.Link v-bind="$attrs">
      <template #element="{ props, elementRef }">
        <a
          v-bind="props"
          :ref="elementRef"
          :href="href ?? undefined"
          :aria-current="isExactActive ? 'page' : undefined"
          @click="navigate"
        >
          <slot />
        </a>
      </template>
    </NavigationMenu.Link>
  </NuxtLink>
</template>
