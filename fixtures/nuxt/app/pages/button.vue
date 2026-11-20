<script setup lang="ts">
import { ref } from 'vue';
import { Button } from '@vase-ui/vue/button';

const count = ref(0);
</script>

<template>
  <main>
    <Button data-testid="counter" @click="count += 1">Count {{ count }}</Button>
    <Button data-testid="disabled" disabled>Disabled</Button>
    <Button data-testid="focusable" disabled focusable-when-disabled>Focusable</Button>
    <Button>
      <template #element="{ props, elementRef }">
        <span data-testid="span" v-bind="props" :ref="elementRef">Span</span>
      </template>
    </Button>
  </main>
</template>
