<script setup lang="ts">
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Select } from '@vase-ui/vue/select';
import { normalizeStyle } from 'vue';
import type { StyleValue } from 'vue';

defineProps<{ open: boolean; aligned: boolean }>();

function property(style: StyleValue, key: string) {
  const normalized = normalizeStyle(style);
  return typeof normalized === 'object' ? normalized[key] : undefined;
}
</script>

<template>
  <DirectionProvider direction="rtl">
    <div dir="rtl" style="position: absolute; top: 150px; left: 100px">
      <Select.Root :open="open" default-value="two" :modal="false">
        <Select.Trigger style="width: 160px"><Select.Value /></Select.Trigger>
        <Select.Positioner :align-item-with-trigger="aligned" align="start">
          <template #render="{ props }">
            <div
              v-bind="props"
              :ref="props.ref"
              data-testid="positioner"
              :data-width="property(props.style, '--anchor-width')"
              :data-origin="property(props.style, '--transform-origin')"
              :data-height="property(props.style, 'height')"
            >
              <Select.Popup data-testid="popup">
                <Select.List>
                  <Select.Item value="one"><Select.ItemText>One</Select.ItemText></Select.Item>
                  <Select.Item value="two"><Select.ItemText>Two</Select.ItemText></Select.Item>
                </Select.List>
              </Select.Popup>
            </div>
          </template>
        </Select.Positioner>
      </Select.Root>
    </div>
  </DirectionProvider>
</template>
