<script setup lang="ts">
import { Tooltip } from '@vase-ui/vue/tooltip';

function stateClass(state: Tooltip.Positioner.State) {
  return state.open ? 'open' : 'closed';
}
</script>

<template>
  <Tooltip.Root>
    <Tooltip.Trigger>Trigger</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Positioner :state-class="stateClass">
        <template #render="{ props, state }">
          <div v-bind="props">
            <ul>
              <li>The tooltip is {{ state.open ? 'open' : 'closed' }}</li>
              <li>I am on the {{ state.side }} side of the anchor</li>
              <li>I am aligned at the {{ state.align }} of the side</li>
              <li>The anchor is {{ state.anchorHidden ? 'hidden' : 'visible' }}</li>
            </ul>
            <Tooltip.Popup>Tooltip</Tooltip.Popup>
          </div>
        </template>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
</template>
