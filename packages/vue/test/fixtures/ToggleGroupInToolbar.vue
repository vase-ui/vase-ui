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
      /** The toggle `one` is a disabled `<span>`. */
      disabledSpan?: boolean;
      /** The toolbar has no button before the group. */
      noFirst?: boolean;
    }>,
    default: () => ({}),
  },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Toolbar.Root :disabled="scene.disabled" :orientation="scene.orientation">
    <Toolbar.Button v-if="!scene.noFirst" id="first">First</Toolbar.Button>
    <Toolbar.Group :disabled="scene.groupDisabled">
      <ToggleGroup v-slot="{ state }" :multiple="scene.multiple" :default-value="['one']">
        <Toggle
          id="one"
          value="one"
          :as="scene.disabledSpan ? 'span' : undefined"
          :disabled="scene.disabledSpan"
        >
          One
        </Toggle>
        <Toggle id="two" value="two">Two</Toggle>
        <span class="State">{{ state.disabled }}</span>
      </ToggleGroup>
    </Toolbar.Group>
    <Toolbar.Button
      :disabled="scene.buttonDisabled"
      :focusable-when-disabled="scene.focusableWhenDisabled ?? true"
    >
      <template #element="{ props, elementRef }">
        <Toggle id="alone" v-bind="props" :ref="elementRef">Alone</Toggle>
      </template>
    </Toolbar.Button>
    <Toolbar.Button id="last">Last</Toolbar.Button>
  </Toolbar.Root>
  <input id="after" aria-label="After" />
</template>
