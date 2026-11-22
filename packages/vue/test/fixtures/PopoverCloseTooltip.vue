<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';
import { Tooltip } from '../../src/tooltip';

type Props = Record<string, unknown>;

// An open popover whose Close is also the trigger of a tooltip. The popup leaves in a
// `<Transition>` of 2 s.
defineProps({ root: Object as PropType<Props> });
</script>

<template>
  <Popover.Root default-open v-bind="root">
    <Popover.Trigger id="trigger-1" style="width: 100px; height: 100px">Trigger</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner data-testid="positioner">
        <Transition name="slow-leave">
          <Popover.Popup data-testid="popup" style="width: 160px; height: 120px">
            <Popover.Close>
              <template #element="{ props, elementRef }">
                <Tooltip.Root>
                  <Tooltip.Trigger v-bind="props" :ref="elementRef">Close</Tooltip.Trigger>
                  <Tooltip.Portal>
                    <Tooltip.Positioner>
                      <Tooltip.Popup>Tooltip</Tooltip.Popup>
                    </Tooltip.Positioner>
                  </Tooltip.Portal>
                </Tooltip.Root>
              </template>
            </Popover.Close>
          </Popover.Popup>
        </Transition>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
</template>

<style>
.slow-leave-leave-active {
  transition: opacity 2s;
}
.slow-leave-leave-to {
  opacity: 0;
}
</style>
