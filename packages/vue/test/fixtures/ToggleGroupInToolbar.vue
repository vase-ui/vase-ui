<script setup lang="ts">
import type { PropType } from 'vue';
import { Toggle } from '../../src/toggle';
import { ToggleGroup } from '../../src/toggle-group';
import { Toolbar } from '../../src/toolbar';

defineProps({
  scene: {
    type: Object as PropType<{
      disabled?: boolean;
      groupDisabled?: boolean;
      multiple?: boolean;
      buttonDisabled?: boolean;
      focusableWhenDisabled?: boolean;
      orientation?: 'horizontal' | 'vertical';
    }>,
    default: () => ({}),
  },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Toolbar.Root :disabled="scene.disabled" :orientation="scene.orientation">
    <Toolbar.Button id="first">First</Toolbar.Button>
    <Toolbar.Group :disabled="scene.groupDisabled">
      <ToggleGroup v-slot="{ state }" :multiple="scene.multiple" :default-value="['one']">
        <Toggle id="one" value="one">One</Toggle>
        <Toggle id="two" value="two">Two</Toggle>
        <span class="State">{{ state.disabled }}</span>
      </ToggleGroup>
    </Toolbar.Group>
    <Toolbar.Button
      :disabled="scene.buttonDisabled"
      :focusable-when-disabled="scene.focusableWhenDisabled ?? true"
    >
      <!-- The test project has motion-v, which adds an `as` of its own to the attributes type. -->
      <template #render="{ props }">
        <Toggle id="alone" v-bind="{ ...props, as: undefined }" :ref="props.ref">Alone</Toggle>
      </template>
    </Toolbar.Button>
    <Toolbar.Button id="last">Last</Toolbar.Button>
  </Toolbar.Root>
  <input id="after" aria-label="After" />
</template>
