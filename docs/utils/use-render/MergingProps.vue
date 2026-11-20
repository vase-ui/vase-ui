<script setup lang="ts">
import { Button } from '@vase-ui/vue/button';
import { mergeProps } from '@vase-ui/vue/merge-props';
</script>

<template>
  <Button>
    <template #element="{ props, elementRef }">
      <button v-bind="mergeProps<'button'>(props, { class: 'button' })" :ref="elementRef">
        Submit
      </button>
    </template>
  </Button>
</template>
