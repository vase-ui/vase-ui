<script setup lang="ts">
import { Menu } from '@vase-ui/vue/menu';
</script>

<template>
  <Menu.Root>
    <Menu.Trigger>
      <template #render="{ props, state }">
        <button v-bind="props" :ref="props.ref">
          <template v-if="state.open">Open</template>
          <template v-else>Closed</template>
        </button>
      </template>
    </Menu.Trigger>
  </Menu.Root>
</template>
