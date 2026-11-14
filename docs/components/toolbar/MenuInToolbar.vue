<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
import { Toolbar } from '@vase-ui/vue/toolbar';
</script>

<template>
  <Toolbar.Root>
    <Menu.Root>
      <Toolbar.Button>
        <template #render="{ props }">
          <Menu.Trigger v-bind="props" />
        </template>
      </Toolbar.Button>
      <Menu.Portal><!-- Compose the rest of the menu --></Menu.Portal>
    </Menu.Root>
  </Toolbar.Root>
</template>
