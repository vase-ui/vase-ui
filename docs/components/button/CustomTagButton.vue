<script setup lang="ts">
import { Button } from '@vase-ui/vue/button';
</script>

<template>
  <Button>
    <template #element="{ props, elementRef }">
      <div v-bind="props" :ref="elementRef">Button that can contain complex children</div>
    </template>
  </Button>
</template>
