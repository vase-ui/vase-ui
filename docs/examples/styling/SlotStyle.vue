<script setup lang="ts">
import { Toggle } from '@vase-ui/vue/toggle';
</script>

<template>
  <Toggle aria-label="Bold">
    <template #render="{ props, state }">
      <button v-bind="props" :ref="props.ref" :style="{ color: state.pressed ? 'red' : 'blue' }" />
    </template>
  </Toggle>
</template>
