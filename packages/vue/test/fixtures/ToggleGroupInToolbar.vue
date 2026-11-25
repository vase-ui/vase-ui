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
      /** The toggle group is disabled. */
      toggleGroupDisabled?: boolean;
      /** The toggle `one` is disabled. */
      disabledOne?: boolean;
      /** The toggle `one` stays in the tab order while disabled. */
      focusableOne?: boolean;
      /** The toggle `one` is a disabled `<span>`. */
      disabledSpan?: boolean;
      /** The toggle `two` is disabled. */
      disabledTwo?: boolean;
      /** The toggle `two` stays in the tab order while disabled. */
      focusableTwo?: boolean;
      /** The toolbar has no button before the group. */
      noFirst?: boolean;
      /** The toolbar has no buttons after the group. */
      noAfter?: boolean;
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
      <ToggleGroup
        v-slot="{ state }"
        :disabled="scene.toggleGroupDisabled"
        :multiple="scene.multiple"
        :default-value="['one']"
      >
        <Toggle
          id="one"
          value="one"
          :as="scene.disabledSpan ? 'span' : undefined"
          :disabled="scene.disabledSpan || scene.disabledOne"
          :focusable-when-disabled="scene.focusableOne"
        >
          One
        </Toggle>
        <Toggle
          id="two"
          value="two"
          :disabled="scene.disabledTwo"
          :focusable-when-disabled="scene.focusableTwo"
        >
          Two
        </Toggle>
        <span class="State">{{ state.disabled }}</span>
      </ToggleGroup>
    </Toolbar.Group>
    <Toolbar.Button
      v-if="!scene.noAfter"
      :disabled="scene.buttonDisabled"
      :focusable-when-disabled="scene.focusableWhenDisabled ?? true"
    >
      <template #element="{ props, elementRef }">
        <Toggle id="alone" v-bind="props" :ref="elementRef">Alone</Toggle>
      </template>
    </Toolbar.Button>
    <Toolbar.Button v-if="!scene.noAfter" id="last">Last</Toolbar.Button>
  </Toolbar.Root>
  <input id="after" aria-label="After" />
</template>
