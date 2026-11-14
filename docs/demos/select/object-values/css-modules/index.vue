<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import styles from './index.module.css';

interface ShippingMethod {
  id: string;
  name: string;
  duration: string;
  price: string;
}

const shippingMethods: ShippingMethod[] = [
  {
    id: 'standard',
    name: 'Standard',
    duration: 'Delivers in 4-6 business days',
    price: '$4.99',
  },
  {
    id: 'express',
    name: 'Express',
    duration: 'Delivers in 2-3 business days',
    price: '$9.99',
  },
  {
    id: 'overnight',
    name: 'Overnight',
    duration: 'Delivers next business day',
    price: '$19.99',
  },
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
    <Select.Root :default-value="shippingMethods[0]" :item-to-string-value="(item) => item.id">
      <Select.Label :class="styles.Label">Shipping method</Select.Label>
      <Select.Trigger :class="styles.Select">
        <Select.Value v-slot="{ value }">
          <span :class="styles.ValueText">
            <span :class="styles.ValuePrimary">{{ (value as ShippingMethod).name }}</span>
            <span :class="styles.ValueSecondary">
              {{ (value as ShippingMethod).duration }} ({{ (value as ShippingMethod).price }})
            </span>
          </span>
        </Select.Value>
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
                v-for="method in shippingMethods"
                :key="method.id"
                :value="method"
                :class="styles.Item"
              >
                <Select.ItemIndicator :class="styles.ItemIndicator">
                  <CheckIcon />
                </Select.ItemIndicator>
                <Select.ItemText :class="styles.ItemText">
                  <span :class="styles.ItemLabel">{{ method.name }}</span>
                  <span :class="styles.ItemDescription">
                    {{ method.duration }} ({{ method.price }})
                  </span>
                </Select.ItemText>
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
