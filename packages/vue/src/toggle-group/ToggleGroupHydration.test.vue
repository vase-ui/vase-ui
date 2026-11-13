<script setup lang="ts">
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import { Toolbar } from '@vase-ui/vue/toolbar';

withDefaults(
  defineProps<{
    toolbar?: boolean;
    toolbarDisabled?: boolean;
    disabled?: boolean;
    firstDisabled?: boolean;
    defaultValue?: string[];
  }>(),
  { toolbar: false, toolbarDisabled: false, disabled: false, firstDisabled: false },
);
</script>

<template>
  <Toolbar.Root v-if="toolbar" :disabled="toolbarDisabled">
    <Toolbar.Button data-testid="before">Before</Toolbar.Button>
    <ToggleGroup data-testid="group" :disabled="disabled" :default-value="defaultValue">
      <Toggle data-testid="a" value="a" :disabled="firstDisabled">A</Toggle>
      <Toggle data-testid="b" value="b">B</Toggle>
      <Toggle data-testid="c" value="c">C</Toggle>
    </ToggleGroup>
    <Toolbar.Button data-testid="after">After</Toolbar.Button>
  </Toolbar.Root>
  <ToggleGroup v-else data-testid="group" :disabled="disabled" :default-value="defaultValue">
    <Toggle data-testid="a" value="a" :disabled="firstDisabled">A</Toggle>
    <Toggle data-testid="b" value="b">B</Toggle>
    <Toggle data-testid="c" value="c">C</Toggle>
  </ToggleGroup>
</template>
