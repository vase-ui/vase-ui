<script setup lang="ts">
import { Toolbar } from '@vase-ui/vue/toolbar';
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Button />
    <Toolbar.Link />
    <Toolbar.Separator />
    <Toolbar.Group>
      <Toolbar.Button />
      <Toolbar.Button />
    </Toolbar.Group>
    <Toolbar.Input />
  </Toolbar.Root>
</template>
