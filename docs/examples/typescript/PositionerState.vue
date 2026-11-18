<script setup lang="ts">
import { Popover } from '@vase-ui/vue/popover';

function popupClass(state: Popover.Positioner.State) {
  return state.open ? 'open' : 'closed';
}
</script>

<template>
  <Popover.Root>
    <Popover.Trigger>Trigger</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <template #render="{ props, state }">
          <div v-bind="props" :ref="props.ref" :class="popupClass(state)">
            <ul>
              <li>The popover is {{ state.open ? 'open' : 'closed' }}</li>
              <li>I am on the {{ state.side }} side of the anchor</li>
              <li>I am aligned at the {{ state.align }} of the side</li>
              <li>The anchor is {{ state.anchorHidden ? 'hidden' : 'visible' }}</li>
            </ul>
            <Popover.Popup>Popover</Popover.Popup>
          </div>
        </template>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>
