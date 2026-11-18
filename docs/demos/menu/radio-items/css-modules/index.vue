<script setup lang="ts">
import { h, shallowRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Menu } from '@vase-ui/vue/menu';
import styles from './index.module.css';

const value = shallowRef('date');

const CaretDownIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M12 6H4l4 4.5z' })],
  );

const CheckIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'm2.5 8.5 4 4 7-9' })],
  );
</script>

<template>
  <Menu.Root>
    <Menu.Trigger :class="styles.Button">
      Sort
      <CaretDownIcon />
    </Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner :class="styles.Positioner" :side-offset="8" align="start">
        <Menu.Popup :class="styles.Popup">
          <Menu.RadioGroup v-model="value">
            <Menu.RadioItem :class="styles.RadioItem" value="date">
              <Menu.RadioItemIndicator :class="styles.RadioItemIndicator">
                <CheckIcon />
              </Menu.RadioItemIndicator>
              <span :class="styles.RadioItemText">Date</span>
            </Menu.RadioItem>
            <Menu.RadioItem :class="styles.RadioItem" value="name">
              <Menu.RadioItemIndicator :class="styles.RadioItemIndicator">
                <CheckIcon />
              </Menu.RadioItemIndicator>
              <span :class="styles.RadioItemText">Name</span>
            </Menu.RadioItem>
            <Menu.RadioItem :class="styles.RadioItem" value="type">
              <Menu.RadioItemIndicator :class="styles.RadioItemIndicator">
                <CheckIcon />
              </Menu.RadioItemIndicator>
              <span :class="styles.RadioItemText">Type</span>
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
</template>
