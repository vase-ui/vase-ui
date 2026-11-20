<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import styles from './index.module.css';

const id = useId();

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  style: { display: 'block' },
};

const CheckIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'none', stroke: 'currentColor', ...attrs }, [
    h('path', { d: 'm2.5 8.5 4 4 7-9' }),
  ]);

const XIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      ...ICON_PROPS,
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      ...attrs,
    },
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );

const CaretDownIcon: FunctionalComponent = (_, { attrs }) =>
  h('svg', { ...ICON_PROPS, fill: 'currentColor', ...attrs }, [h('path', { d: 'M12 6H4l4 4.5z' })]);

interface Fruit {
  id: string;
  name: string;
}

const fruits: Fruit[] = [
  { id: 'apple', name: 'Apple' },
  { id: 'banana', name: 'Banana' },
  { id: 'orange', name: 'Orange' },
  { id: 'pineapple', name: 'Pineapple' },
  { id: 'grape', name: 'Grape' },
  { id: 'mango', name: 'Mango' },
  { id: 'strawberry', name: 'Strawberry' },
  { id: 'blueberry', name: 'Blueberry' },
  { id: 'raspberry', name: 'Raspberry' },
  { id: 'blackberry', name: 'Blackberry' },
  { id: 'cherry', name: 'Cherry' },
  { id: 'peach', name: 'Peach' },
  { id: 'pear', name: 'Pear' },
  { id: 'plum', name: 'Plum' },
  { id: 'kiwi', name: 'Kiwi' },
  { id: 'watermelon', name: 'Watermelon' },
];

const items = Combobox.createItems(fruits, {
  getValue: (fruit) => fruit.id,
  getLabel: (fruit) => fruit.name,
});

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Combobox.Root :items="items" default-value="banana">
    <div :class="styles.Label">
      <label :for="id">Choose a fruit</label>
      <Combobox.InputGroup :class="styles.InputGroup">
        <Combobox.Input :id="id" placeholder="e.g. Apple" :class="styles.Input" />
        <div :class="styles.ActionButtons">
          <Combobox.Clear :class="styles.Clear" aria-label="Clear selection">
            <XIcon />
          </Combobox.Clear>
          <Combobox.Trigger :class="styles.Trigger" aria-label="Open popup">
            <CaretDownIcon />
          </Combobox.Trigger>
        </div>
      </Combobox.InputGroup>
    </div>

    <Combobox.Portal>
      <Combobox.Positioner :class="styles.Positioner" :side-offset="4">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Combobox.Popup :class="styles.Popup">
            <Combobox.Empty>
              <div :class="styles.Empty">No fruits found.</div>
            </Combobox.Empty>
            <Combobox.List :class="styles.List">
              <template #item="{ item }">
                <Combobox.Item v-slot="{ state }" :value="item.id" :class="styles.Item">
                  <span v-if="state.selected" :class="styles.ItemIndicator">
                    <CheckIcon />
                  </span>
                  <span :class="styles.ItemText">{{ item.name }}</span>
                </Combobox.Item>
              </template>
            </Combobox.List>
          </Combobox.Popup>
        </Transition>
      </Combobox.Positioner>
    </Combobox.Portal>
  </Combobox.Root>
</template>
