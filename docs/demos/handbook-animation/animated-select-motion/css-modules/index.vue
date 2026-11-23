<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Select } from '@vase-ui/vue/select';
import { animate } from 'motion-v';
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

// The popup stays in the DOM, so the hooks of the `<Transition>` run at each open and close.
function enter(element: Element, done: () => void) {
  void animate(element, { opacity: 1, scale: 1 }, { duration: 0.15 }).then(done);
}

function leave(element: Element, done: () => void) {
  void animate(element, { opacity: 0, scale: 0.8 }, { duration: 0.15 }).then(done);
}

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
        <Transition :css="false" @enter="enter" @leave="leave">
          <Select.Popup :class="styles.Popup">
            <Select.ScrollUpArrow :class="styles.ScrollUpArrow" />
            <Select.List :class="styles.List">
              <Select.Item
                v-for="{ label, value } in fonts"
                :key="label"
                :value="value"
                :class="styles.Item"
                v-slot="{ state }"
              >
                <span v-if="state.selected" :class="styles.ItemIndicator">
                  <CheckIcon />
                </span>
                <Select.ItemText :class="styles.ItemText">{{ label }}</Select.ItemText>
              </Select.Item>
            </Select.List>
            <Select.ScrollDownArrow :class="styles.ScrollDownArrow" />
          </Select.Popup>
        </Transition>
      </Select.Positioner>
    </Select.Portal>
  </Select.Root>
</template>
