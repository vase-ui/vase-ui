<script setup lang="ts">
import { Toolbar } from '@vase-ui/vue/toolbar';

defineProps<{ as?: 'hr' }>();
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Button>Button</Toolbar.Button>
    <Toolbar.Separator :as="as" />
    <Toolbar.Button>Button</Toolbar.Button>
  </Toolbar.Root>
</template>
