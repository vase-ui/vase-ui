<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Collapsible } from '@vase-ui/vue/collapsible';
import styles from './index.module.css';

const CaretRightIcon: FunctionalComponent = () =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'currentColor',
      style: { display: 'block' },
    },
    [h('path', { d: 'M6 12V4l4.5 4z' })],
  );
</script>

<template>
  <Collapsible.Root :class="styles.Collapsible">
    <Collapsible.Trigger :class="styles.Trigger">
      Recovery keys
      <CaretRightIcon :class="styles.Icon" />
    </Collapsible.Trigger>
    <Collapsible.Panel :class="styles.Panel">
      <div :class="styles.Content">
        <div>alien-bean-pasta</div>
        <div>wild-irish-burrito</div>
        <div>horse-battery-staple</div>
      </div>
    </Collapsible.Panel>
  </Collapsible.Root>
</template>
