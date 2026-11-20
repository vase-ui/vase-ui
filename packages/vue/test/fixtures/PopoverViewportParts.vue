<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';

type Props = Record<string, unknown>;

// Two triggers of one root, side by side, and a viewport whose content has the id of the active
// trigger as its `key` in a `<Transition>`.
defineProps({
  root: Object as PropType<Props>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <div style="display: flex; gap: 200px; padding: 20px">
    <Popover.Root v-bind="root">
      <template #default="{ payload }">
        <Popover.Trigger id="one" payload="One">One</Popover.Trigger>
        <Popover.Trigger id="two" payload="Two">Two</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup data-testid="popup">
              <Popover.Viewport data-testid="viewport">
                <template #default="{ triggerId }">
                  <Transition name="slide" @leave="log.add('leave')" @enter="log.add('enter')">
                    <div :key="triggerId ?? ''" class="content" :data-content="payload">
                      {{ payload }}
                    </div>
                  </Transition>
                </template>
              </Popover.Viewport>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </template>
    </Popover.Root>
  </div>
</template>
