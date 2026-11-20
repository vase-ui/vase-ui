<script setup lang="ts">
import { h, shallowRef } from 'vue';
import type { FunctionalComponent } from 'vue';
import { Popover } from '@vase-ui/vue/popover';
import styles from '../../_index.module.css';

const demoPopover = Popover.createHandle();

const open = shallowRef(false);
const triggerId = shallowRef<string | null>(null);

function handleOpenChange(isOpen: boolean, eventDetails: Popover.Root.ChangeEventDetails) {
  open.value = isOpen;
  triggerId.value = eventDetails.trigger?.id ?? null;
}

function openProgrammatically() {
  triggerId.value = 'trigger-2';
  open.value = true;
}

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
  <div :class="styles.Container">
    <Popover.Trigger :class="styles.Button" :handle="demoPopover" id="trigger-1">
      Trigger 1
    </Popover.Trigger>

    <Popover.Trigger :class="styles.Button" :handle="demoPopover" id="trigger-2">
      Trigger 2
    </Popover.Trigger>

    <Popover.Trigger :class="styles.Button" :handle="demoPopover" id="trigger-3">
      Trigger 3
    </Popover.Trigger>

    <button type="button" :class="styles.Button" @click="openProgrammatically">
      Open programmatically
    </button>
  </div>

  <Popover.Root
    :handle="demoPopover"
    :open="open"
    :trigger-id="triggerId"
    @open-change="handleOpenChange"
  >
    <Popover.Portal>
      <Popover.Positioner :class="styles.Positioner" :side-offset="8">
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
