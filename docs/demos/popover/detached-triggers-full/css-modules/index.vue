<script setup lang="ts">
import { h } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Popover } from '@vase-ui/vue/popover';
import baseStyles from '../../_index.module.css';
import styles from './index.module.css';

type Panel = 'shipping' | 'returns' | 'profile';

const demoPopover = Popover.createHandle<Panel>();

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
</script>

<template>
  <div :class="styles.Container">
    <Popover.Trigger :class="baseStyles.Button" :handle="demoPopover" payload="shipping">
      Shipping
    </Popover.Trigger>

    <Popover.Trigger :class="baseStyles.Button" :handle="demoPopover" payload="returns">
      Returns
    </Popover.Trigger>

    <Popover.Trigger :class="baseStyles.Button" :handle="demoPopover" payload="profile">
      Profile
    </Popover.Trigger>

    <Popover.Root v-slot="{ payload }" :handle="demoPopover">
      <Popover.Portal>
        <Popover.Positioner :side-offset="8" :class="styles.Positioner">
          <Popover.Popup :class="styles.Popup">
            <Popover.Arrow :class="styles.Arrow" />

            <Popover.Viewport :class="styles.Viewport">
              <div v-if="payload === 'shipping'" :class="styles.Stack">
                <Popover.Title :class="styles.Title">Free shipping</Popover.Title>
                <Popover.Description :class="styles.Description">
                  Orders over $50 arrive in 3–5 business days at no extra cost.
                </Popover.Description>
              </div>
              <div v-else-if="payload === 'returns'" :class="styles.Stack">
                <Popover.Title :class="styles.Title">Free returns</Popover.Title>
                <Popover.Description :class="styles.Description">
                  Return any item within 30 days for a full refund.
                </Popover.Description>
              </div>
              <div v-else-if="payload === 'profile'" :class="styles.ProfilePanel">
                <Popover.Title :class="styles.Title">Jason Eventon</Popover.Title>
                <img
                  src="https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=128&h=128&dpr=2&q=80"
                  width="48"
                  height="48"
                  alt=""
                  :class="styles.Avatar"
                />
                <span :class="styles.Plan">Pro plan</span>
                <div :class="styles.ProfileActions">
                  <a href="#">Profile settings</a>
                  <a href="#">Log out</a>
                </div>
              </div>
            </Popover.Viewport>

            <Popover.Close aria-label="Close" :class="styles.Close">
              <XIcon />
            </Popover.Close>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  </div>
</template>
