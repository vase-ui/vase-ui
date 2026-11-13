<script setup lang="ts">
import { Button } from '@vase-ui/vue/button';
import { mergeProps } from '@vase-ui/vue/merge-props';
import type { HTMLProps } from '@vase-ui/vue/types';

function getButtonProps(props: HTMLProps): Record<string, unknown> {
  return mergeProps<'button'>(props, { class: 'button' });
}
</script>

<template>
  <Button>
    <template #render="{ props }">
      <button v-bind="getButtonProps(props)">Submit</button>
    </template>
  </Button>
</template>
