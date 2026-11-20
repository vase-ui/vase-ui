<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger>
      <template #render="{ props, state }">
        <button v-bind="props" :ref="props.ref" :class="state.open ? 'open' : 'closed'">
          Settings
        </button>
      </template>
    </Menu.Trigger>
  </Menu.Root>
</template>
