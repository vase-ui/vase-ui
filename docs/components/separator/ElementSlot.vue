<script setup lang="ts">
import { Separator } from '@vase-ui/vue/separator';
</script>

<template>
  <p class="details">
    <span>3 min read</span>
    <Separator orientation="vertical">
      <template #element="{ props, elementRef }">
        <span v-bind="props" :ref="elementRef" class="separator" />
      </template>
    </Separator>
    <span>November 19</span>
  </p>
</template>
