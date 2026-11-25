<script setup lang="ts">
import type { PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { Toggle } from '../../src/toggle';
import { ToggleGroup } from '../../src/toggle-group';

defineProps({
  scene: {
    type: Object as PropType<{
      kind: 'fieldset' | 'root';
      disabled: boolean;
      ownDisabled?: boolean;
      focusable?: boolean;
      customDisabled?: boolean;
    }>,
    required: true,
  },
});
</script>

<template>
  <component :is="scene.kind === 'root' ? Fieldset.Root : 'fieldset'" :disabled="scene.disabled">
    <legend>
      <Toggle v-slot="{ state }" class="InLegend">Legend {{ state.disabled }}</Toggle>
      <ToggleGroup v-slot="{ state }" class="GroupInLegend">
        <Toggle value="a">A</Toggle>
        <span class="State">{{ state.disabled }}</span>
      </ToggleGroup>
    </legend>
    <Toggle
      v-slot="{ state }"
      class="Native"
      :disabled="scene.ownDisabled"
      :focusable-when-disabled="scene.focusable"
    >
      Native {{ state.disabled }}
    </Toggle>
    <Toggle v-slot="{ state }" as="span" class="Custom">Custom {{ state.disabled }}</Toggle>
    <ToggleGroup v-slot="{ state }" class="Group">
      <Toggle value="a" class="GroupNative" :focusable-when-disabled="scene.focusable">A</Toggle>
      <Toggle
        value="b"
        as="span"
        class="GroupCustom"
        :disabled="scene.customDisabled"
        :focusable-when-disabled="scene.focusable"
      >
        B
      </Toggle>
      <span class="State">{{ state.disabled }}</span>
    </ToggleGroup>
  </component>
</template>
