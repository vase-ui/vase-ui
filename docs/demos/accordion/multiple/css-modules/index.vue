<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import styles from '../../_index.module.css';

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
</script>

<template>
  <Accordion.Root :class="styles.Accordion" multiple>
    <Accordion.Item :class="styles.Item">
      <Accordion.Header :class="styles.Header">
        <Accordion.Trigger :class="styles.Trigger">
          What is Vase UI?
          <PlusIcon :class="styles.Icon" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel :class="styles.Panel">
        <div :class="styles.Content">
          Vase UI is a library of unstyled, accessible Vue components for design systems and web
          apps.
        </div>
      </Accordion.Panel>
    </Accordion.Item>

    <Accordion.Item :class="styles.Item">
      <Accordion.Header :class="styles.Header">
        <Accordion.Trigger :class="styles.Trigger">
          How do I get started?
          <PlusIcon :class="styles.Icon" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel :class="styles.Panel">
        <div :class="styles.Content">
          Head to the “Quick start” guide in the docs. If you’ve used unstyled libraries before,
          you’ll feel at home.
        </div>
      </Accordion.Panel>
    </Accordion.Item>

    <Accordion.Item :class="styles.Item">
      <Accordion.Header :class="styles.Header">
        <Accordion.Trigger :class="styles.Trigger">
          Can I use it for my project?
          <PlusIcon :class="styles.Icon" />
        </Accordion.Trigger>
      </Accordion.Header>
      <Accordion.Panel :class="styles.Panel">
        <div :class="styles.Content">Yes. Vase UI is free and open source.</div>
      </Accordion.Panel>
    </Accordion.Item>
  </Accordion.Root>
</template>
