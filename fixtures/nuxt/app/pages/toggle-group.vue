<script setup lang="ts">
import { ref } from 'vue';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import { Toolbar } from '@vase-ui/vue/toolbar';

const alignment = ref(['center']);
</script>

<template>
  <main>
    <ToggleGroup v-model:value="alignment" data-testid="alone">
      <Toggle data-testid="alone-1" value="left">Left</Toggle>
      <Toggle data-testid="alone-2" value="center">Center</Toggle>
      <Toggle data-testid="alone-3" value="right">Right</Toggle>
    </ToggleGroup>
    <output data-testid="alone-value">{{ alignment.join(',') }}</output>
    <ToggleGroup data-testid="disabled-first">
      <Toggle data-testid="disabled-first-1" value="one" disabled>One</Toggle>
      <Toggle data-testid="disabled-first-2" value="two">Two</Toggle>
    </ToggleGroup>
    <Toolbar.Root data-testid="in-toolbar">
      <Toolbar.Button data-testid="in-toolbar-1">Save</Toolbar.Button>
      <ToggleGroup :default-value="['bold']">
        <Toggle data-testid="in-toolbar-2" value="bold">Bold</Toggle>
        <Toggle data-testid="in-toolbar-3" value="italic">Italic</Toggle>
      </ToggleGroup>
    </Toolbar.Root>
    <Toggle data-testid="single" default-pressed>Favorite</Toggle>
  </main>
</template>
