<script setup lang="ts">
import { h, useId } from 'vue';
import type { FunctionalComponent } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import styles from './index.module.css';

const id = useId();

const CursorGrowIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '26',
      height: '14',
      viewBox: '0 0 24 14',
      fill: 'black',
      stroke: 'white',
      style: { display: 'block' },
    },
    [
      h('path', {
        d: 'M19.5 5.5L6.49737 5.51844V2L1 6.9999L6.5 12L6.49737 8.5L19.5 8.5V12L25 6.9999L19.5 2V5.5Z',
      }),
    ],
  );

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
  <NumberField.Root :id="id" :default-value="100" :class="styles.Field">
    <NumberField.ScrubArea :class="styles.ScrubArea">
      <label :for="id" :class="styles.Label">Amount</label>
      <NumberField.ScrubAreaCursor :class="styles.ScrubAreaCursor">
        <CursorGrowIcon />
      </NumberField.ScrubAreaCursor>
    </NumberField.ScrubArea>

    <NumberField.Group :class="styles.Group">
      <NumberField.Decrement :class="styles.Decrement">
        <MinusIcon />
      </NumberField.Decrement>
      <NumberField.Input :class="styles.Input" />
      <NumberField.Increment :class="styles.Increment">
        <PlusIcon />
      </NumberField.Increment>
    </NumberField.Group>
  </NumberField.Root>
</template>
