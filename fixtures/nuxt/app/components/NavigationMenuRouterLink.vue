<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { RouterLink, type RouteLocationRaw } from 'vue-router';

// A native `<a>` in the `element` slot of the link, in the slot of `<RouterLink custom>`, so that
// the arrow keys of the menu reach it. The `<a>` of the current route has `aria-current="page"`.
defineOptions({ inheritAttrs: false });
defineProps<{ to: RouteLocationRaw }>();
</script>

<template>
  <RouterLink v-slot="{ href, navigate, isExactActive }" :to="to" custom>
    <NavigationMenu.Link>
      <template #element="{ props, elementRef }">
        <a
          v-bind="{ ...props, ...$attrs }"
          :ref="elementRef"
          :href="href"
          :aria-current="isExactActive ? 'page' : undefined"
          @click="navigate"
        >
          <slot />
        </a>
      </template>
    </NavigationMenu.Link>
  </RouterLink>
</template>
