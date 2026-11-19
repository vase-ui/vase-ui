<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import styles from './index.module.css';

const CheckIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'aria-hidden': 'true',
    },
    [h('path', { d: 'm2.5 8.5 4 4 7-9' })],
  );
</script>

<template>
  <label :class="styles.Label">
    <span :class="styles.Box">
      <Checkbox default-checked :class="styles.Checkbox" />
      <CheckIcon :class="styles.Indicator" />
    </span>
    Enable notifications
  </label>
</template>
