<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@vase-ui/vue/button';
import { mergeProps } from '@vase-ui/vue/merge-props';
import type { HTMLProps } from '@vase-ui/vue/types';

const locked = ref(true);

function getButtonProps(props: HTMLProps): Record<string, unknown> {
  return mergeProps<'div'>(props, {
    onKeydown(event) {
      if (locked.value) {
        event.preventVaseUIHandler();
      }
    },
    onKeyup(event) {
      if (locked.value) {
        event.preventVaseUIHandler();
      }
    },
  });
}
</script>

<template>
  <Button :native-button="false">
    <template #render="{ props }">
      <div v-bind="getButtonProps(props)">Favorite {{ locked ? '(locked)' : '(unlocked)' }}</div>
    </template>
  </Button>
  <button type="button" @click="locked = !locked">{{ locked ? 'Unlock' : 'Lock' }}</button>
</template>
