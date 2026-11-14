<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import styles from './index.module.css';

const groupedProduce = [
  {
    value: 'Fruits',
    items: [
      { value: 'apple', label: 'Apple' },
      { value: 'banana', label: 'Banana' },
      { value: 'mango', label: 'Mango' },
      { value: 'kiwi', label: 'Kiwi' },
      { value: 'grape', label: 'Grape' },
      { value: 'orange', label: 'Orange' },
      { value: 'strawberry', label: 'Strawberry' },
      { value: 'watermelon', label: 'Watermelon' },
    ],
  },
  {
    value: 'Vegetables',
    items: [
      { value: 'broccoli', label: 'Broccoli' },
      { value: 'carrot', label: 'Carrot' },
      { value: 'cauliflower', label: 'Cauliflower' },
      { value: 'cucumber', label: 'Cucumber' },
      { value: 'kale', label: 'Kale' },
      { value: 'pepper', label: 'Bell pepper' },
      { value: 'spinach', label: 'Spinach' },
      { value: 'zucchini', label: 'Zucchini' },
    ],
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
    <Select.Root :items="groupedProduce">
      <Select.Label :class="styles.Label">Produce</Select.Label>
      <Select.Trigger :class="styles.Select">
        <Select.Value :class="styles.Value" placeholder="Select produce" />
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
              <template v-for="(group, index) in groupedProduce" :key="group.value">
                <Select.Group :class="styles.Group">
                  <Select.GroupLabel :class="styles.GroupLabel">{{
                    group.value
                  }}</Select.GroupLabel>
                  <Select.Item
                    v-for="item in group.items"
                    :key="item.value"
                    :value="item.value"
                    :class="styles.Item"
                  >
                    <Select.ItemIndicator :class="styles.ItemIndicator">
                      <CheckIcon />
                    </Select.ItemIndicator>
                    <Select.ItemText :class="styles.ItemText">{{ item.label }}</Select.ItemText>
                  </Select.Item>
                </Select.Group>
                <Select.Separator
                  v-if="index < groupedProduce.length - 1"
                  :class="styles.Separator"
                />
              </template>
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
