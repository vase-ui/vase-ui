<script setup lang="ts">
import type { PropType } from 'vue';
import { Menu } from '../../src/menu';

type Props = Record<string, unknown>;

// Two triggers of one root, side by side, and a viewport whose content has the id of the active
// trigger as its `key` in a `<Transition>`. The content of the second trigger is taller.
defineProps({
  positioner: Object as PropType<Props>,
  popup: Object as PropType<Props>,
});
</script>

<template>
  <div style="display: flex; gap: 200px; padding: 20px">
    <Menu.Root :modal="false">
      <template #default="{ payload }">
        <Menu.Trigger id="one" payload="One">One</Menu.Trigger>
        <Menu.Trigger id="two" payload="Two">Two</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="positioner" v-bind="positioner">
            <Menu.Popup data-testid="popup" class="sized" v-bind="popup">
              <Menu.Viewport data-testid="viewport">
                <template #default="{ triggerId }">
                  <Transition name="slide">
                    <div
                      :key="triggerId ?? ''"
                      class="content"
                      :style="{ height: payload === 'Two' ? '80px' : '40px' }"
                    >
                      <Menu.Item>{{ payload }}</Menu.Item>
                    </div>
                  </Transition>
                </template>
              </Menu.Viewport>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </template>
    </Menu.Root>
  </div>
</template>

<style>
.sized {
  height: var(--popup-height, auto);
  overflow: hidden;
  transition: height 80ms;
}
</style>
