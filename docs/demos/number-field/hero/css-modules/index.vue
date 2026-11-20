<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import styles from './index.module.css';

const id = useId();

const PlusIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      style: { display: 'block' },
    },
    [h('path', { d: 'M1.5 8h13M8 14.5v-13' })],
  );

const MinusIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linecap': 'square',
      'stroke-linejoin': 'round',
      style: { display: 'block' },
    },
    [h('path', { d: 'M1.5 8h13' })],
  );
</script>

<template>
  <NumberField.Root :default-value="100" :class="styles.Field">
    <NumberField.ScrubArea :class="styles.ScrubArea">
      <label :for="id" :class="styles.Label">Amount</label>
    </NumberField.ScrubArea>

    <NumberField.Group :class="styles.Group">
      <NumberField.Decrement aria-label="Decrease" :class="styles.Decrement">
        <MinusIcon />
      </NumberField.Decrement>
      <NumberField.Input :id="id" :class="styles.Input" />
      <NumberField.Increment aria-label="Increase" :class="styles.Increment">
        <PlusIcon />
      </NumberField.Increment>
    </NumberField.Group>
  </NumberField.Root>
</template>
