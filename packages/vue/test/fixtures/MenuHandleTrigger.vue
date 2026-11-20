<script setup lang="ts">
import { Menu } from '../../src/menu';

// A trigger of a handle that no root uses.
const handle = Menu.createHandle();
</script>

<template>
  <Menu.Trigger :handle="handle" data-testid="trigger">Menu</Menu.Trigger>
</template>
