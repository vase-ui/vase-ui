<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import styles from './index.module.css';

const apples = [
  { label: 'Gala', value: 'gala' },
  { label: 'Fuji', value: 'fuji' },
  { label: 'Honeycrisp', value: 'honeycrisp' },
  { label: 'Granny Smith', value: 'granny-smith' },
  { label: 'Pink Lady', value: 'pink-lady' },
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

const CaretUpIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [
    h('path', { d: 'M12 10H4l4-4.5z' }),
  ]);

const CaretDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [h('path', { d: 'M12 6H4l4 4.5z' })]);
</script>

<template>
  <div :class="styles.Field">
    <Select.Root :items="apples">
      <Select.Label :class="styles.Label">Apple</Select.Label>
      <Select.Trigger :class="styles.Select">
        <Select.Value :class="styles.Value" placeholder="Select apple" />
        <Select.Icon>
          <CaretUpDownIcon />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner :class="styles.Positioner" :side-offset="4">
          <Select.Popup :class="styles.Popup">
            <Select.ScrollUpArrow :class="styles.ScrollArrow">
              <CaretUpIcon />
            </Select.ScrollUpArrow>
            <Select.List :class="styles.List">
              <Select.Item
                v-for="{ label, value } in apples"
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
            <Select.ScrollDownArrow :class="styles.ScrollArrow">
              <CaretDownIcon />
            </Select.ScrollDownArrow>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </div>
</template>
