<script setup lang="ts">
import { Toggle } from '@vase-ui/vue/toggle';
</script>

<template>
  <Toggle aria-label="Bold">
    <template #render="{ props, state }">
      <button v-bind="props" :ref="props.ref">
        <template v-if="state.pressed">On</template>
        <template v-else>Off</template>
      </button>
    </template>
  </Toggle>
</template>
