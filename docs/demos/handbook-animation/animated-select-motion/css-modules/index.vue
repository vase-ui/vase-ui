<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import { motion } from 'motion-v';
import type { MotionProps } from 'motion-v';
import styles from './index.module.css';

const fonts = [
  { label: 'Select font', value: null },
  { label: 'Sans-serif', value: 'sans' },
  { label: 'Serif', value: 'serif' },
  { label: 'Monospace', value: 'mono' },
  { label: 'Cursive', value: 'cursive' },
];

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CaretUpDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [
    h('path', { d: 'M11 10H5l3 3.5zm0-4H5l3-3.5z' }),
  ]);

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);
</script>

<template>
  <Select.Root :items="fonts">
    <Select.Trigger aria-label="Font" :class="styles.Select">
      <Select.Value :class="styles.Value" />
      <Select.Icon>
        <CaretUpDownIcon />
      </Select.Icon>
    </Select.Trigger>
    <Select.Portal>
      <Select.Positioner :class="styles.Positioner" :side-offset="4">
        <Select.Popup :class="styles.Popup">
          <template #render="{ props, state }">
            <motion.div
              v-bind="props as MotionProps"
              :initial="{ opacity: 0, scale: 0.8 }"
              :animate="{ opacity: state.open ? 1 : 0, scale: state.open ? 1 : 0.8 }"
            >
              <Select.ScrollUpArrow :class="styles.ScrollArrow" />
              <Select.List :class="styles.List">
                <Select.Item
                  v-for="{ label, value } in fonts"
                  :key="label"
                  :value="value"
                  :class="styles.Item"
                >
                  <Select.ItemIndicator :class="styles.ItemIndicator">
                    <CheckIcon />
                  </Select.ItemIndicator>
                  <Select.ItemText :class="styles.ItemText">{{ label }}</Select.ItemText>
                </Select.Item>
              </Select.List>
              <Select.ScrollDownArrow :class="styles.ScrollArrow" />
            </motion.div>
          </template>
        </Select.Popup>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
