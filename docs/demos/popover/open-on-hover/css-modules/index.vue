<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Popover } from '@vase-ui/vue/popover';
import styles from '../../_index.module.css';

const InfoIcon: FunctionalComponent = (_, { attrs }) =>
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
      ...attrs,
      style: { display: 'block' },
    },
    [
      h('circle', { cx: '8', cy: '8', r: '6.5' }),
      h('path', { d: 'M8 7.5v3.5' }),
      h('circle', { cx: '8', cy: '5', r: '0.75', fill: 'currentColor', stroke: 'none' }),
    ],
  );

const XIcon: FunctionalComponent = (_, { attrs }) =>
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
      ...attrs,
      style: { display: 'block' },
    },
    [h('path', { d: 'm4.5 4.5 7 7m-7 0 7-7' })],
  );

const popupHiddenClass = styles.PopupHidden;
</script>

<template>
  <Popover.Root>
    <Popover.Trigger open-on-hover :class="styles.IconButton" aria-label="Shipping information">
      <InfoIcon />
    </Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner :side-offset="8">
        <Transition :enter-from-class="popupHiddenClass" :leave-to-class="popupHiddenClass" appear>
          <Popover.Popup :class="styles.Popup">
            <Popover.Arrow :class="styles.Arrow" />
            <Popover.Title :class="styles.Title">Free shipping</Popover.Title>
            <Popover.Description :class="styles.Description">
              Orders over $50 arrive in 3–5 business days at no extra cost.
            </Popover.Description>
            <a href="#" :class="styles.Link">View shipping policy</a>
            <Popover.Close aria-label="Close" :class="styles.Close">
              <XIcon />
            </Popover.Close>
          </Popover.Popup>
        </Transition>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
