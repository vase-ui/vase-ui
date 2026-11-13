<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import styles from './index.module.css';

const ICON_PROPS = {
  width: '16',
  height: '16',
  viewBox: '0 0 16 16',
  stroke: 'currentColor',
  style: { display: 'block' },
};

const AlignLeftIcon: FunctionalComponent = () =>
  h('svg', { ...ICON_PROPS, fill: 'none' }, [
    h('path', {
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      d: 'M2.5 4.5h11m-11 7h9M2.5 8h5',
    }),
  ]);

const AlignCenterIcon: FunctionalComponent = () =>
  h('svg', ICON_PROPS, [
    h('path', {
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      d: 'M2.5 4.5h11m-10 7h9M5.5 8h5',
    }),
  ]);

const AlignRightIcon: FunctionalComponent = () =>
  h('svg', ICON_PROPS, [
    h('path', {
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      d: 'M2.5 4.5h11m-9 7h9M8.5 8h5',
    }),
  ]);
</script>

<template>
  <ToggleGroup aria-label="Text alignment" :default-value="['left']" :class="styles.Panel">
    <Toggle aria-label="Align left" value="left" :class="styles.Button">
      <AlignLeftIcon />
    </Toggle>
    <Toggle aria-label="Align center" value="center" :class="styles.Button">
      <AlignCenterIcon />
    </Toggle>
    <Toggle aria-label="Align right" value="right" :class="styles.Button">
      <AlignRightIcon />
    </Toggle>
  </ToggleGroup>
</template>
