<script setup lang="ts">
import type { Directive } from 'vue';
import * as NavigationMenu from '../index.parts';

withDefaults(defineProps<{ defaultValue?: string | null; shown?: boolean }>(), {
  defaultValue: null,
  shown: true,
});

const vMark: Directive<HTMLElement, string> = {
  mounted(element, binding) {
    element.setAttribute('data-mark', binding.value);
  },
};
</script>

<template>
  <NavigationMenu.Root :default-value="defaultValue">
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger
          v-show="shown"
          v-mark="'marked'"
          class="trigger"
          data-testid="trigger"
        >
          One
        </NavigationMenu.Trigger>
        <NavigationMenu.Content><a href="#one">Link</a></NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Viewport />
  </NavigationMenu.Root>
</template>

<style scoped>
.trigger {
  outline-style: dashed;
}
</style>
