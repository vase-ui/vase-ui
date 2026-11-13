<script setup lang="ts">
import { Toolbar } from '@vase-ui/vue/toolbar';

withDefaults(
  defineProps<{
    disabled?: boolean;
    first?: 'enabled' | 'disabled' | 'focusable';
  }>(),
  { disabled: false, first: 'enabled' },
);
</script>

<template>
  <Toolbar.Root :disabled="disabled">
    <Toolbar.Button
      data-testid="a"
      :disabled="first !== 'enabled'"
      :focusable-when-disabled="first !== 'disabled'"
    >
      A
    </Toolbar.Button>
    <Toolbar.Button data-testid="b">B</Toolbar.Button>
    <Toolbar.Button data-testid="c" as="span" :native-button="false">C</Toolbar.Button>
  </Toolbar.Root>
</template>
