<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import styles from '../../index.module.css';

const demoTooltip = Tooltip.createHandle();

const TrashIcon: FunctionalComponent = (_, { attrs }) =>
  h(
    'svg',
    {
      width: '16',
      height: '16',
      viewBox: '0 0 16 16',
      fill: 'none',
      stroke: 'currentColor',
      'stroke-linejoin': 'round',
      ...attrs,
      style: { display: 'block' },
    },
    [
      h('path', { 'stroke-linecap': 'square', d: 'M2.5 4h11' }),
      h('path', {
        'stroke-linecap': 'round',
        d: 'M6.5 4V3c0-.82843.67157-1.5 1.5-1.5s1.5.67157 1.5 1.5v1',
      }),
      h('path', {
        'stroke-linecap': 'square',
        d: 'm3.5 4 .87069 9.1422c.07332.7699.7199 1.3578 1.49324 1.3578h4.27217c.7733 0 1.4199-.5879 1.4932-1.3578L12.5 4',
      }),
    ],
  );
</script>

<template>
  <Tooltip.Provider>
    <Tooltip.Trigger :class="styles.IconButton" :handle="demoTooltip" aria-label="Delete">
      <TrashIcon aria-hidden="true" />
    </Tooltip.Trigger>

    <Tooltip.Root :handle="demoTooltip">
      <Tooltip.Portal>
        <Tooltip.Positioner :side-offset="11">
          <Tooltip.Popup :class="styles.Popup">
            <Tooltip.Arrow :class="styles.Arrow" />
            Delete
          </Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  </Tooltip.Provider>
</template>
