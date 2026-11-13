<script setup lang="ts">
import { Button } from '@vase-ui/vue/button';
import { mergeProps } from '@vase-ui/vue/merge-props';
</script>

<template>
  <Button>
    <template #render="{ props }">
      <button v-bind="mergeProps<'button'>(props, { class: 'button' })">Submit</button>
    </template>
  </Button>
</template>
