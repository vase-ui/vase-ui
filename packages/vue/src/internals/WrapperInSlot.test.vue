<script setup lang="ts">
import { Toolbar } from '@vase-ui/vue/toolbar';

defineProps<{ focusableWhenDisabled?: boolean }>();
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Button :focusable-when-disabled="focusableWhenDisabled"><slot /></Toolbar.Button>
  </Toolbar.Root>
</template>
