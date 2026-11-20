<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toggle } from '../../src/toggle';
import { ToggleGroup } from '../../src/toggle-group';

// Each item is a toggle with the id of its key. Its value is `value`, or else its key.
defineProps({
  group: Object as PropType<Record<string, unknown>>,
  items: {
    type: Array as PropType<{ key: string; value?: string; attrs?: Record<string, unknown> }[]>,
    required: true,
  },
});
const groupPart = useTemplateRef('groupPart');
defineExpose({ group: groupPart });
</script>

<template>
  <!-- WebKit on macOS gives Tab no button, so text inputs stand around the group. -->
  <input id="before" aria-label="Before" />
  <ToggleGroup ref="groupPart" v-slot="{ state }" v-bind="group">
    <Toggle
      v-for="item in items"
      :id="item.key"
      :key="item.key"
      :value="'value' in item ? item.value : item.key"
      v-bind="item.attrs"
    >
      {{ item.key }}
    </Toggle>
    <span class="State">{{ state.disabled }} {{ state.multiple }} {{ state.orientation }}</span>
  </ToggleGroup>
  <input id="after" aria-label="After" />
</template>
