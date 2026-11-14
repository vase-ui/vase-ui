<script setup lang="ts">
import type { Directive } from 'vue';
import * as NavigationMenu from '../index.parts';

withDefaults(
  defineProps<{ mode?: 'scoped' | 'directive' | 'show' | 'transition'; shown?: boolean }>(),
  {
    mode: 'scoped',
    shown: true,
  },
);

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <NavigationMenu.Root>
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
        <NavigationMenu.Content><a href="#one">Link</a></NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner>
        <NavigationMenu.Popup data-testid="popup">
          <Transition v-if="mode === 'transition'">
            <NavigationMenu.Viewport class="viewport" data-testid="viewport" />
          </Transition>
          <NavigationMenu.Viewport
            v-else-if="mode === 'directive'"
            v-mark="'marked'"
            class="viewport"
            data-testid="viewport"
          />
          <NavigationMenu.Viewport
            v-else-if="mode === 'show'"
            v-show="shown"
            class="viewport"
            data-testid="viewport"
          />
          <NavigationMenu.Viewport v-else class="viewport" data-testid="viewport" />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
</template>

<style scoped>
.viewport {
  outline-style: dashed;
}
</style>
