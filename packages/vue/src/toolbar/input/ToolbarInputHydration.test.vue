<script setup lang="ts">
import { Toolbar } from '@vase-ui/vue/toolbar';

withDefaults(defineProps<{ first?: 'enabled' | 'disabled' | 'focusable' }>(), {
  first: 'enabled',
});
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Input
      data-testid="input"
      default-value="abcd"
      :disabled="first !== 'enabled'"
      :focusable-when-disabled="first !== 'disabled'"
    />
    <Toolbar.Button data-testid="button">Button</Toolbar.Button>
  </Toolbar.Root>
</template>
