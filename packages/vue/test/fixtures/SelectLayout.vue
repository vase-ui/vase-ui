<script setup lang="ts">
import { Select } from '@vase-ui/vue/select';
import { normalizeStyle } from 'vue';
import type { StyleValue } from 'vue';

defineProps<{ open: boolean; aligned: boolean; width: number; inPlace?: boolean }>();

function property(style: unknown, key: string) {
  const normalized = normalizeStyle(style as StyleValue);
  return typeof normalized === 'object' ? normalized[key] : undefined;
}
</script>

<template>
  <div dir="rtl" style="position: absolute; top: 150px; left: 100px">
    <Select.Root :open="open" default-value="two" :modal="false">
      <Select.Trigger data-testid="trigger" :style="{ width: width + 'px' }">
        <Select.Value data-testid="value" />
      </Select.Trigger>
      <Select.Portal :disabled="inPlace">
        <Select.Positioner :align-item-with-trigger="aligned" align="start" dir="rtl">
          <template #element="{ props, elementRef }">
            <div
              v-bind="props"
              :ref="elementRef"
              data-testid="positioner"
              :data-width="property(props.style, '--anchor-width')"
              :data-origin="property(props.style, '--transform-origin')"
              :data-height="property(props.style, 'height')"
            >
              <Select.Popup data-testid="popup">
                <Select.List>
                  <Select.Item value="one"><Select.ItemText>One</Select.ItemText></Select.Item>
                  <Select.Item value="two"
                    ><Select.ItemText data-testid="selected">Two</Select.ItemText></Select.Item
                  >
                </Select.List>
              </Select.Popup>
            </div>
          </template>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
</template>
