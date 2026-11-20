<script setup lang="ts">
import type { PropType } from 'vue';
import { Popover } from '../../src/popover';

type Props = Record<string, unknown>;

// Two triggers of one root, side by side, and a viewport whose content has the id of the active
// trigger as its `key` in a `<Transition>`. The second trigger is 3 px lower than the first, and
// its content is taller. The popup animates its height from `--popup-height`.
defineProps({
  root: Object as PropType<Props>,
  positioner: Object as PropType<Props>,
  log: { type: Object as PropType<{ add(entry: string): void }>, default: () => ({ add() {} }) },
});
</script>

<template>
  <div style="display: flex; gap: 200px; padding: 20px">
    <Popover.Root v-bind="root">
      <template #default="{ payload }">
        <Popover.Trigger id="one" payload="One">One</Popover.Trigger>
        <Popover.Trigger id="two" payload="Two" style="margin-top: 3px">Two</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner data-testid="positioner" v-bind="positioner">
            <Popover.Popup data-testid="popup" class="sized">
              <Popover.Viewport data-testid="viewport">
                <template #default="{ triggerId }">
                  <Transition name="slide" @leave="log.add('leave')" @enter="log.add('enter')">
                    <div
                      :key="triggerId ?? ''"
                      class="content"
                      :data-content="payload"
                      :style="{ height: payload === 'Two' ? '80px' : '40px' }"
                    >
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

<style>
.sized {
  height: var(--popup-height, auto);
  overflow: hidden;
  transition: height 80ms;
}
</style>
