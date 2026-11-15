<script setup lang="ts">
import { shallowRef } from 'vue';
import { Toolbar } from '@vase-ui/vue/toolbar';

const props = defineProps<{
  // The consumer gives `:value` and takes the text in its `input` listener.
  controlled?: boolean | undefined;
}>();

const text = shallowRef('abc');
const inputs = shallowRef<string[]>([]);

function handleInput(event: Event) {
  const value = (event.currentTarget as HTMLInputElement).value;
  inputs.value = [...inputs.value, value];
  if (props.controlled) {
    text.value = value;
  }
}
</script>

<template>
  <Toolbar.Root>
    <Toolbar.Input v-if="controlled" :value="text" data-testid="input" @input="handleInput" />
    <Toolbar.Input v-else default-value="abc" data-testid="input" @input="handleInput" />
  </Toolbar.Root>
  <output data-testid="text">{{ text }}</output>
  <output data-testid="inputs">{{ inputs.join('; ') }}</output>
</template>
